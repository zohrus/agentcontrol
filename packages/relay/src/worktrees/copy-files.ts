import { dirname, join } from "node:path";
import { mkdir } from "node:fs/promises";

const SKIPPED = new Set(["node_modules", ".git"]);

function isSkipped(path: string): boolean {
  return path.split("/").some((part) => SKIPPED.has(part));
}

async function scan(repoPath: string, pattern: string): Promise<string[]> {
  const found: string[] = [];
  const glob = new Bun.Glob(pattern);
  for await (const path of glob.scan({ cwd: repoPath, dot: true, onlyFiles: true })) {
    if (!isSkipped(path)) found.push(path);
  }
  return found;
}

async function matchingFiles(repoPath: string, patterns: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const pattern of patterns) {
    for (const path of await scan(repoPath, pattern)) found.add(path);
  }
  return found;
}

/** Copies files matching the glob patterns from the main checkout to the same relative path. */
export async function copyFiles(options: {
  repoPath: string;
  worktreePath: string;
  patterns: string[];
}): Promise<string[]> {
  const files = await matchingFiles(options.repoPath, options.patterns);
  for (const path of files) {
    const target = join(options.worktreePath, path);
    await mkdir(dirname(target), { recursive: true });
    await Bun.write(target, Bun.file(join(options.repoPath, path)));
  }
  return [...files];
}
