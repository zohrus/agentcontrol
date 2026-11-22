import { cp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AGENT_RULES } from "./rules.ts";

const SKIPPED = new Set(["node_modules", "dist"]);

const isTemplateFile = (source: string): boolean => {
  const name = source.slice(source.lastIndexOf("/") + 1);
  return !SKIPPED.has(name) && !name.startsWith(".");
};

/**
 * The default UI of this app release, as it is written into the history: the template package's
 * files plus AGENTS.md (the Modify agent's rules ship with every release), copied into
 * `<dataDir>/ui-template`. Its node_modules links to the template package's, as the live and
 * staging folders' do. Rebuilt on every start, so it always matches the running release.
 */
export async function prepareTemplate(options: {
  templateDir: string;
  dataDir: string;
}): Promise<string> {
  const target = join(options.dataDir, "ui-template");
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
  await cp(options.templateDir, target, { recursive: true, filter: isTemplateFile });
  await writeFile(join(target, "AGENTS.md"), AGENT_RULES);
  const modules = await realpath(join(options.templateDir, "node_modules"));
  await symlink(modules, join(target, "node_modules"), "dir");
  return target;
}
