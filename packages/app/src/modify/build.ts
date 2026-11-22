import { join } from "node:path";
import { createUiVersions } from "../ui-versions/index.ts";
import { createUiWorkspace } from "../ui-workspace/index.ts";
import { createAgentTurns } from "./agent-turns.ts";
import { type Ctx, NO_CHANGE, refresh } from "./context.ts";
import { persistIn } from "./persist.ts";
import type { Seed } from "./seed.ts";
import type { ModifyOptions } from "./types.ts";

function foldersOf(options: ModifyOptions) {
  const { dataDir, templateVersion } = options;
  const versions = createUiVersions({ gitDir: join(dataDir, "ui.git"), now: () => new Date() });
  const templateDir = join(dataDir, "ui-template");
  const workspace = createUiWorkspace({ dataDir, templateDir, templateVersion, versions });
  return { versions, workspace };
}

/** Wires the Modify agent's parts together: history, UI folders, agent sessions and state. */
export function buildCtx(options: ModifyOptions): { ctx: Ctx; seed: Seed } {
  const { dataDir, templateDir, templateVersion } = options;
  const { versions, workspace } = foldersOf(options);
  const turns = createAgentTurns({
    relay: options.relay,
    events: options.events,
    folder: workspace.stagingDir,
    agent: options.agent,
    onSession: () => {
      refresh(ctx);
    },
  });
  const ctx: Ctx = {
    workspace,
    versions,
    turns,
    publish: options.publish,
    persist: persistIn(dataDir),
    state: { status: "idle", gate: "idle", changedFiles: [] },
    change: NO_CHANGE,
    available: undefined,
    finishing: false,
  };
  return { ctx, seed: { dataDir, templateDir, templateVersion, workspace, versions } };
}
