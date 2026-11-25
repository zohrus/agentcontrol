// One folder per platform with everything the app needs at run time. For macOS it becomes the
// `Contents/Resources` of the app bundle, for Linux it is what a tarball would hold:
//
//   agentcontrol                  the app
//   agentcontrol-relay            the relay for this platform
//   relays/                       the Linux relays that remote workspaces are installed from
//   resources/ui-template/        the default UI: sources, node_modules and dist (built)
import { copyFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { type SharedUiParts, writeUiResources } from "./ui-resources.ts";

const REMOTE_RELAYS = ["linux-x64", "linux-arm64"];

export interface ReleaseOptions {
  /** `<os>-<arch>`, for example `darwin-arm64`. */
  platform: string;
  /** The folder the compiled binaries are in (`dist`). */
  binDir: string;
  /** The app's types, the same for every platform. */
  shared: SharedUiParts;
}

/** The compiled files a release folder needs, as paths in `binDir`, keyed by their place in it. */
export function releaseFiles(
  options: Pick<ReleaseOptions, "platform" | "binDir">,
): Record<string, string> {
  const { platform, binDir } = options;
  const files: Record<string, string> = {
    agentcontrol: join(binDir, `agentcontrol-${platform}`),
    "agentcontrol-relay": join(binDir, `agentcontrol-relay-${platform}`),
  };
  for (const remote of REMOTE_RELAYS) {
    files[`relays/agentcontrol-relay-${remote}`] = join(binDir, `agentcontrol-relay-${remote}`);
  }
  return files;
}

/** Builds `<binDir>/release/<platform>/`; returns its path. */
export async function assembleRelease(options: ReleaseOptions): Promise<string> {
  const folder = join(options.binDir, "release", options.platform);
  await rm(folder, { recursive: true, force: true });
  await mkdir(join(folder, "relays"), { recursive: true });
  for (const [name, source] of Object.entries(releaseFiles(options))) {
    await copyFile(source, join(folder, name));
  }
  await writeUiResources({
    platform: options.platform,
    resources: join(folder, "resources"),
    shared: options.shared,
  });
  return folder;
}
