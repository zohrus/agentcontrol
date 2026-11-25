import { cp, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModifyConfig } from "@agentcontrol/app";
import { onTestEnd } from "./cleanup.ts";
import { type RunningApp, startAppWithLocalWorkspace } from "./start-app.ts";

const fixtureDir = join(import.meta.dir, "../../fixtures/ui-template");
const realModules = join(import.meta.dir, "../../../packages/ui-template/node_modules");

/** The app, with a tiny default UI (see e2e/fixtures/ui-template) and the mock agent as Modify agent. */
export interface ModifiableApp extends RunningApp {
  /** The folder of the default UI this app release ships; a new release changes files in it. */
  readonly templateDir: string;
}

/** A copy of the fixture UI that the test owns; its node_modules is the real one, for tsc and vite. */
export async function createUiTemplate(files: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "agentcontrol-ui-template-"));
  onTestEnd(() => rm(dir, { recursive: true, force: true }));
  await cp(fixtureDir, dir, { recursive: true });
  await symlink(realModules, join(dir, "node_modules"), "dir");
  for (const [path, content] of Object.entries(files)) await Bun.write(join(dir, path), content);
  return dir;
}

const baseConfig = (templateDir: string, agent: ModifyConfig["agent"]): ModifyConfig => ({
  agent,
  templateDir,
  templateVersion: "1.0",
});

const mockAgentMain = join(import.meta.dir, "../mock-agent/main.ts");

/** Which UI the app serves besides its API, if any: the dev server, or a production build. */
function uiServedBy(options: { withUi?: boolean; productionUi?: boolean }) {
  return {
    ...(options.withUi && { withUi: true }),
    ...(options.productionUi && { productionUi: true }),
  };
}

/**
 * Starts the app with default UI version 1.0, ready for Modify requests. The Modify agent is the
 * mock agent; with `agent: "claude-code"` it is started as Claude Code would be, but the command
 * behind that name is the mock agent too.
 */
export async function startAppWithModifiableUi(
  options: {
    agent?: ModifyConfig["agent"];
    withUi?: boolean;
    /** Serve a production build of the live UI, as a release does. */
    productionUi?: boolean;
    /** Files of the default UI that differ from the fixture's (path in the UI folder, content). */
    templateFiles?: Record<string, string>;
  } = {},
): Promise<ModifiableApp> {
  const templateDir = await createUiTemplate(options.templateFiles);
  const agent = options.agent ?? "mock";
  const relayEnv = { AGENTCONTROL_AGENT_CLAUDE_CODE_CMD: JSON.stringify(["bun", mockAgentMain]) };
  const modify = baseConfig(templateDir, agent);
  const app = await startAppWithLocalWorkspace({
    modify,
    ...uiServedBy(options),
    ...(agent === "mock" ? {} : { relayEnv }),
  });
  return Object.assign(app, { templateDir });
}

/** A new app release: its default UI changes these files, and the app starts again with it. */
export async function releaseDefaultUiUpdate(
  app: ModifiableApp,
  release: { version: string; files: Record<string, string> },
): Promise<void> {
  for (const [path, content] of Object.entries(release.files)) {
    await writeFile(join(app.templateDir, path), content);
  }
  const modify = { ...baseConfig(app.templateDir, "mock"), templateVersion: release.version };
  await app.restartsTheApp({ modify });
}

/** A link inside the staging folder that points at a file outside it which does not exist yet. */
export async function plantDanglingLinkInStaging(
  app: ModifiableApp,
  link: { name: string; target: string },
): Promise<void> {
  await symlink(link.target, join(app.dataDir, "ui-staging", link.name));
}

/** The hidden version history is gone, so merging a default UI update cannot work. */
export function deleteTheUiHistory(app: ModifiableApp): Promise<void> {
  return rm(join(app.dataDir, "ui.git"), { recursive: true, force: true });
}
