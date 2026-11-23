import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/** What a release ships next to the app binary (see docs/releasing.md for the layout). */
export interface Resources {
  /** The default UI project: its sources and installed node_modules. */
  templateDir: string;
  /** True for a release (or an AGENTCONTROL_RESOURCES folder); false in a source checkout. */
  shipped: boolean;
  /** The relay binary of this platform, when the release has one next to the app. */
  relayBinary: string | undefined;
  /** The folder of Linux relay binaries that remote workspaces are installed from. */
  relaysDir: string | undefined;
}

export interface FindOptions {
  env: Record<string, string | undefined>;
  /** The running binary: the app itself when compiled, the `bun` that runs the source otherwise. */
  execPath: string;
}

const SOURCE_TEMPLATE = join(import.meta.dir, "../../../ui-template");

/**
 * The folders that may hold the release's files: the parent of AGENTCONTROL_RESOURCES, or else
 * next to the binary (inside a Mac bundle that is `Contents/Resources`), or `Contents/Resources`
 * when the binary is in `Contents/MacOS`.
 */
function releaseRoots(options: FindOptions): string[] {
  const given = options.env["AGENTCONTROL_RESOURCES"];
  if (given !== undefined) return [dirname(given)];
  const here = dirname(options.execPath);
  return [here, join(here, "..", "Resources")];
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((path) => existsSync(path));
}

function shippedTemplate(options: FindOptions): string | undefined {
  const given = options.env["AGENTCONTROL_RESOURCES"];
  if (given !== undefined) return join(given, "ui-template");
  return firstExisting(releaseRoots(options).map((root) => join(root, "resources", "ui-template")));
}

/**
 * The one place that knows where the release's files are. In order: the folder named by
 * AGENTCONTROL_RESOURCES (it holds `ui-template/`), `resources/` next to the binary, then
 * `Contents/Resources/resources` of a Mac bundle. A source checkout falls back to
 * `packages/ui-template`. Throws when none of them has a default UI.
 */
export function findResources(options: FindOptions): Resources {
  const shipped = shippedTemplate(options);
  const templateDir = shipped ?? SOURCE_TEMPLATE;
  if (!existsSync(join(templateDir, "package.json"))) {
    throw new Error(
      `AgentControl's default UI was not found at ${templateDir}. Reinstall the app, or set AGENTCONTROL_RESOURCES to the resources folder of a release.`,
    );
  }
  const roots = releaseRoots(options);
  const relayBinary = firstExisting(roots.map((root) => join(root, "agentcontrol-relay")));
  const relaysDir = firstExisting(roots.map((root) => join(root, "relays")));
  return { templateDir, shipped: shipped !== undefined, relayBinary, relaysDir };
}
