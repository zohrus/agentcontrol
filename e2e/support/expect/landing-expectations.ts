import { originMainFile, originMainHas, type Project, type Ran } from "../setup/landing-project.ts";

/** The script ended well, and its output says this. */
export function expectScriptToSucceedSaying(ran: Ran, text: string): void {
  if (ran.exitCode !== 0 || !ran.output.includes(text)) {
    throw new Error(
      `expected the script to succeed saying "${text}", but it exited ${String(ran.exitCode)} printing: ${ran.output}`,
    );
  }
}

/** The script refused, and its output says this. */
export function expectScriptToRefuseSaying(ran: Ran, text: string): void {
  if (ran.exitCode === 0 || !ran.output.includes(text)) {
    throw new Error(
      `expected the script to refuse saying "${text}", but it exited ${String(ran.exitCode)} printing: ${ran.output}`,
    );
  }
}

/** Origin's main does not have this file: nothing of the branch landed. */
export async function expectMainToLack(project: Project, file: string): Promise<void> {
  if (await originMainHas(project, file)) {
    throw new Error(`expected origin's main not to have ${file}, but the branch's work landed`);
  }
}

/** Origin's main now holds the file with this text: the branch's work landed. */
export async function expectMainToHold(
  project: Project,
  wanted: { file: string; text: string },
): Promise<void> {
  const text = await originMainFile(project, wanted.file);
  if (text !== wanted.text) {
    throw new Error(
      `expected origin's main to hold ${wanted.file} as "${wanted.text.trim()}", but it holds "${text.trim()}"`,
    );
  }
}
