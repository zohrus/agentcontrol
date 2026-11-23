import { existsSync } from "node:fs";

export interface Target {
  /** File name under dist/. */
  name: string;
  /** Entry file, relative to the repository root. */
  entry: string;
  /** The `bun build --compile --target` value. */
  bunTarget: string;
}

const RELAY_ENTRY = "packages/relay/src/main.ts";
const APP_ENTRY = "packages/app/src/main.ts";

const relayPlatforms = ["linux-x64", "linux-arm64", "darwin-arm64", "darwin-x64"] as const;
const macPlatforms = ["darwin-arm64", "darwin-x64"] as const;

/** The platforms that get a release folder: the Macs, and Linux x64 when asked for (CI smoke). */
export function appPlatforms(options: { linuxApp: boolean }): string[] {
  return options.linuxApp ? [...macPlatforms, "linux-x64"] : [...macPlatforms];
}

/** Every binary the release ships, in build order. */
export function allTargets(options: { linuxApp: boolean }): Target[] {
  const relays = relayPlatforms.map((platform) => ({
    name: `agentcontrol-relay-${platform}`,
    entry: RELAY_ENTRY,
    bunTarget: `bun-${platform}`,
  }));
  const apps = appPlatforms(options).map((platform) => ({
    name: `agentcontrol-${platform}`,
    entry: APP_ENTRY,
    bunTarget: `bun-${platform}`,
  }));
  return [...relays, ...apps];
}

/** Splits the targets into those whose entry file exists and those that must be skipped. */
export function splitByEntry(targets: Target[]): { build: Target[]; skipped: Target[] } {
  const build = targets.filter((target) => existsSync(target.entry));
  return { build, skipped: targets.filter((target) => !build.includes(target)) };
}
