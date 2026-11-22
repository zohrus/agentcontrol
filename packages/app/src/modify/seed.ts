import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { UiVersions } from "../ui-versions/index.ts";
import type { UiWorkspace } from "../ui-workspace/index.ts";
import { prepareTemplate } from "./template.ts";

export interface Seed {
  dataDir: string;
  /** The template package of this app release. */
  templateDir: string;
  templateVersion: string;
  workspace: UiWorkspace;
  versions: UiVersions;
}

const markerPath = (dataDir: string) => join(dataDir, "ui-upstream-version");

async function readMarker(dataDir: string): Promise<string | undefined> {
  return readFile(markerPath(dataDir), "utf8").then(
    (text) => text.trim(),
    () => undefined,
  );
}

/** The default-UI version that the user's UI is built on: the newest template or update commit. */
async function appliedVersion(versions: UiVersions): Promise<string | undefined> {
  const history = await versions.history();
  return history.find((version) => version.templateVersion !== undefined)?.templateVersion;
}

/**
 * First run: creates `<dataDir>/ui` and `ui-staging` from the template and the history. Later
 * runs: when this release has a newer default UI than the last one seen, commits it to `upstream`
 * so an update can be offered. Returns the version that is available to merge, if any.
 */
export async function seedUi(seed: Seed): Promise<string | undefined> {
  const { dataDir, templateVersion, workspace, versions } = seed;
  const templateDir = await prepareTemplate(seed);
  await workspace.ensureReady();
  const known = await readMarker(dataDir);
  if (known !== undefined && known !== templateVersion) {
    await versions.addTemplateVersion({ templateDir, templateVersion });
  }
  await writeFile(markerPath(dataDir), templateVersion);
  const applied = await appliedVersion(versions);
  return applied === templateVersion || applied === undefined ? undefined : templateVersion;
}
