import { cp, mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";

const fixtureDir = join(import.meta.dir, "../../fixtures/ui-template");
const uiTemplatePackage = join(import.meta.dir, "../../../packages/ui-template");

/** A `resources` folder as a release ships it, with the default UI of the e2e fixture inside. */
export interface ResourcesFolder {
  /** The folder AGENTCONTROL_RESOURCES points at. */
  readonly path: string;
  /** The text of the file that is in this folder's `node_modules`, to tell two folders apart. */
  readonly modulesMarker: string;
}

/** A folder that is removed when the test ends. */
async function temporaryFolder(prefix: string): Promise<string> {
  const folder = await mkdtemp(join(tmpdir(), prefix));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  return folder;
}

/**
 * A resources folder whose node_modules holds one marker file, so that the folder a UI took its
 * dependencies from can be told from another one. Enough for an app that only prepares the UI.
 */
export async function aResourcesFolder(name: string): Promise<ResourcesFolder> {
  const path = await temporaryFolder(`agentcontrol-resources-${name}-`);
  const template = join(path, "ui-template");
  await cp(fixtureDir, template, { recursive: true });
  await writeFile(join(template, "package.json"), '{"name":"fixture-ui","private":true}');
  await mkdir(join(template, "node_modules"));
  const modulesMarker = `dependencies of ${name}`;
  await writeFile(join(template, "node_modules", "marker.txt"), modulesMarker);
  return { path, modulesMarker };
}

/**
 * A resources folder that can run a UI server: the dev server script and the real Vite in its
 * node_modules (a link to the one this repository has installed).
 */
export async function aResourcesFolderWithTools(): Promise<ResourcesFolder> {
  const folder = await aResourcesFolder("with-tools");
  const template = join(folder.path, "ui-template");
  await rm(join(template, "node_modules"), { recursive: true });
  await symlink(join(uiTemplatePackage, "node_modules"), join(template, "node_modules"), "dir");
  await cp(join(uiTemplatePackage, "server.ts"), join(template, "server.ts"));
  return folder;
}
