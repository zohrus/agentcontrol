import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join } from "node:path";

const MAX_INCLUDE_DEPTH = 3;

/** Host aliases from the `Host` lines of one ssh config text, skipping patterns (`*`, `?`, `!`). */
function hostsInConfig(text: string): string[] {
  const hosts = text.split("\n").flatMap((line) => {
    const match = /^\s*Host\s+(.+?)\s*$/i.exec(line);
    return match?.[1]?.split(/\s+/) ?? [];
  });
  return hosts.filter((host) => !/[*?!]/.test(host));
}

function includesIn(text: string): string[] {
  return text.split("\n").flatMap((line) => {
    const match = /^\s*Include\s+(.+?)\s*$/i.exec(line);
    return match?.[1]?.split(/\s+/) ?? [];
  });
}

/** The files an `Include` pattern names; a `*` is allowed in the last part only. */
function matchingFiles(pattern: string): string[] {
  const glob = new Bun.Glob(basename(pattern));
  try {
    return [...glob.scanSync({ cwd: dirname(pattern), absolute: true })];
  } catch {
    return []; // the folder does not exist: ssh ignores such an Include too
  }
}

/** Where an `Include` points: `~/` is the home folder, a relative path is relative to the ssh folder. */
function includePath(options: { pattern: string; sshDir: string }): string {
  const { pattern, sshDir } = options;
  if (isAbsolute(pattern)) return pattern;
  if (pattern.startsWith("~/")) return join(homedir(), pattern.slice(2));
  return join(sshDir, pattern);
}

async function readIfThere(path: string): Promise<string> {
  return Bun.file(path)
    .text()
    .catch(() => "");
}

async function hostsInFile(options: {
  path: string;
  depth: number;
  sshDir: string;
}): Promise<string[]> {
  const { path, depth, sshDir } = options;
  const text = await readIfThere(path);
  if (depth >= MAX_INCLUDE_DEPTH) return hostsInConfig(text);
  const patterns = includesIn(text).map((pattern) => includePath({ pattern, sshDir }));
  const files = patterns.flatMap(matchingFiles);
  const included = await Promise.all(
    files.map((file) => hostsInFile({ path: file, depth: depth + 1, sshDir })),
  );
  return [...hostsInConfig(text), ...included.flat()];
}

/** The host aliases a user has in their ssh config (`~/.ssh/config`, or the given file), in order, once each. */
export async function sshConfigHosts(configFile?: string): Promise<string[]> {
  const path = configFile ?? join(homedir(), ".ssh", "config");
  return [...new Set(await hostsInFile({ path, depth: 0, sshDir: dirname(path) }))];
}
