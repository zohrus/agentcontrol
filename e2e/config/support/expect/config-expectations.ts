import { readFile } from "node:fs/promises";
import type { ConfigPlan, DriftReport } from "@agentcontrol/sdk";
import type { Folder } from "../setup/config-app.ts";

const shown = (text: string | undefined): string =>
  text === undefined ? "no such file" : JSON.stringify(text);

/** The file exists and its text includes this. */
export async function expectFileToContain(
  folder: Folder,
  call: { file: string; text: string },
): Promise<void> {
  const content = await folder.read(call.file);
  if (content === undefined || !content.includes(call.text)) {
    throw new Error(
      `expected ${call.file} to contain ${JSON.stringify(call.text)}, but it holds ${shown(content)}`,
    );
  }
}

/** There is no file at that path. */
export async function expectNoFile(folder: Folder, file: string): Promise<void> {
  const content = await folder.read(file);
  if (content !== undefined) {
    throw new Error(`expected no file at ${file}, but it holds ${shown(content)}`);
  }
}

/** The file is a JSON document whose value at this path (dots between names) is exactly this. */
export async function expectJsonValue(
  folder: Folder,
  call: { file: string; path: string; value: unknown },
): Promise<void> {
  const content = await folder.read(call.file);
  const found = call.path
    .split(".")
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      content === undefined ? undefined : JSON.parse(content),
    );
  if (JSON.stringify(found) !== JSON.stringify(call.value)) {
    throw new Error(
      `expected ${call.file} to have ${call.path} = ${JSON.stringify(call.value)}, but it has ${JSON.stringify(found)}`,
    );
  }
}

/** Every file the plan listed now holds exactly the content the plan showed. */
export async function expectFilesToBeWrittenAsPlanned(plan: ConfigPlan): Promise<void> {
  const written = plan.changes.filter((change) => change.action !== "delete");
  for (const { path, after } of written) {
    const content = await readFile(path, "utf8");
    if (content !== after) {
      throw new Error(
        `expected ${path} to hold what the plan showed, ${shown(after)}, but it holds ${shown(content)}`,
      );
    }
  }
}

/** The plan lists this many files to change. */
export function expectPlanToChangeFiles(plan: ConfigPlan, count: number): void {
  if (plan.changes.length !== count) {
    const paths = plan.changes.map((c) => c.path).join(", ");
    throw new Error(
      `expected the plan to change ${String(count)} files, but it changes ${String(plan.changes.length)}: ${paths}`,
    );
  }
}

/** The plan names the item as not written for the agent, with a reason that says why. */
export function expectItemUnsupported(
  plan: ConfigPlan,
  call: { agent: string; itemId: string; reasonIncludes: string },
): void {
  const found = plan.unsupported.find(
    (u) =>
      u.agent === call.agent && u.itemId === call.itemId && u.reason.includes(call.reasonIncludes),
  );
  if (!found) {
    const listed = JSON.stringify(plan.unsupported);
    throw new Error(
      `expected the plan to say "${call.itemId}" is unsupported for ${call.agent} because ${call.reasonIncludes}, but it says ${listed}`,
    );
  }
}

/** The plan reports nothing as unsupported for this agent and item. */
export function expectItemSupported(
  plan: ConfigPlan,
  call: { agent: string; itemId: string },
): void {
  const found = plan.unsupported.filter((u) => u.agent === call.agent && u.itemId === call.itemId);
  if (found.length > 0) {
    throw new Error(
      `expected "${call.itemId}" to be supported for ${call.agent}, but the plan says ${JSON.stringify(found)}`,
    );
  }
}

/** The drift report flags this file as changed by hand and names the item. */
export function expectDriftIn(report: DriftReport, call: { file: string; itemId: string }): void {
  const entry = report.entries.find((e) => e.path.endsWith(call.file));
  const ok = entry?.status === "drift" && entry.itemIds.includes(call.itemId);
  if (!ok) {
    throw new Error(
      `expected ${call.file} to be reported as drifted for "${call.itemId}", but the report says ${JSON.stringify(report.entries)}`,
    );
  }
}

/** The drift report flags no file at all. */
export function expectNoDrift(report: DriftReport): void {
  const off = report.entries.filter((e) => e.status !== "in-sync");
  if (off.length > 0) {
    throw new Error(`expected every managed file to be in sync, but ${JSON.stringify(off)}`);
  }
}

/** Both folders hold the same files with the same bytes. */
export function expectSameFiles(call: {
  before: Record<string, string>;
  after: Record<string, string>;
}): void {
  const names = [...new Set([...Object.keys(call.before), ...Object.keys(call.after)])];
  const differing = names.filter((name) => call.before[name] !== call.after[name]);
  if (differing.length > 0) {
    throw new Error(
      `expected the files to be unchanged, but these differ: ${differing.join(", ")}`,
    );
  }
}

/** The app refused the request for this reason. */
export function expectRequestToBeRefusedAs(reason: string | undefined, expected: string): void {
  if (reason !== expected) {
    throw new Error(
      `expected the app to refuse the request as "${expected}", but ${reason === undefined ? "it applied" : `it said "${reason}"`}`,
    );
  }
}

/** The file exists and its text does not include this. */
export async function expectFileNotToContain(
  folder: Folder,
  call: { file: string; text: string },
): Promise<void> {
  const content = await folder.read(call.file);
  if (content === undefined || content.includes(call.text)) {
    throw new Error(
      `expected ${call.file} to exist without ${JSON.stringify(call.text)}, but it holds ${shown(content)}`,
    );
  }
}

/** The plan says the item needs this secret, which the user still has to provide. */
export function expectPlanToNeedSecret(
  plan: ConfigPlan,
  call: { itemId: string; secret: string },
): void {
  const found = plan.needsSecret.some((n) => n.itemId === call.itemId && n.secret === call.secret);
  if (!found) {
    throw new Error(
      `expected the plan to need secret ${call.secret} for "${call.itemId}", but it says ${JSON.stringify(plan.needsSecret)}`,
    );
  }
}

/** The file's text includes this exactly once. */
export async function expectFileToContainOnce(
  folder: Folder,
  call: { file: string; text: string },
): Promise<void> {
  const content = await folder.read(call.file);
  const times = content === undefined ? 0 : content.split(call.text).length - 1;
  if (times !== 1) {
    throw new Error(
      `expected ${call.file} to contain ${JSON.stringify(call.text)} once, but it does ${String(times)} times`,
    );
  }
}
