import { join } from "node:path";
import type { AppAccess } from "../setup/app.ts";

/** The version in the root package.json, which every part of a release reports. */
async function releaseVersion(): Promise<string> {
  const root = (await Bun.file(join(import.meta.dir, "../../../package.json")).json()) as {
    version: string;
  };
  return root.version;
}

/** The workspace says its relay is connected and is the version of this release. */
export async function expectRelayToBeOfThisRelease(app: AppAccess): Promise<void> {
  const workspace = await app.sdk.workspace.get();
  const version = await releaseVersion();
  if (
    workspace.state !== "connected" ||
    workspace.relayVersion !== version ||
    workspace.appVersion !== version
  ) {
    throw new Error(
      `expected the workspace to be connected to a relay of version ${version}, but it is ${workspace.state} with relay ${workspace.relayVersion ?? "unknown"}`,
    );
  }
}

/** The workspace says the relay needs an update, and names the version it has. */
export async function expectWorkspaceToNeedARelayUpdate(
  app: AppAccess,
  relayVersion: string,
): Promise<void> {
  const workspace = await app.sdk.workspace.get();
  if (workspace.state !== "needs-relay-update" || workspace.relayVersion !== relayVersion) {
    throw new Error(
      `expected the workspace to need a relay update from ${relayVersion}, but it is ${workspace.state} with relay ${workspace.relayVersion ?? "unknown"}`,
    );
  }
}
