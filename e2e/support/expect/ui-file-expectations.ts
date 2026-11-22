import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess } from "../setup/app.ts";

const liveFile = (app: AppAccess, path: string) => join(app.dataDir, "ui", path);

async function readFileOrMissing(path: string): Promise<string> {
  return readFile(path, "utf8").catch(() => "(the file is missing)");
}

export async function expectLiveUiFileToContain(
  app: AppAccess,
  expected: { path: string; text: string },
): Promise<void> {
  const content = await readFileOrMissing(liveFile(app, expected.path));
  if (!content.includes(expected.text)) {
    throw new Error(
      `expected live UI file ${expected.path} to contain "${expected.text}", but it has: ${content}`,
    );
  }
}

export async function expectLiveUiFileNotToContain(
  app: AppAccess,
  expected: { path: string; text: string },
): Promise<void> {
  const content = await readFileOrMissing(liveFile(app, expected.path));
  if (content.includes(expected.text)) {
    throw new Error(
      `expected live UI file ${expected.path} not to contain "${expected.text}", but it has: ${content}`,
    );
  }
}

export async function expectStagingUiFileToContain(
  app: AppAccess,
  expected: { path: string; text: string },
): Promise<void> {
  const content = await readFileOrMissing(join(app.dataDir, "ui-staging", expected.path));
  if (!content.includes(expected.text)) {
    throw new Error(
      `expected staging UI file ${expected.path} to contain "${expected.text}", but it has: ${content}`,
    );
  }
}
