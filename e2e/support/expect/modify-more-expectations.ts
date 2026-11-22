import { access } from "node:fs/promises";
import { join } from "node:path";
import { ApiError } from "@agentcontrol/sdk";
import type { AppAccess } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";

/** The app refused the request, with this reason code (a plain-language message comes with it). */
export async function expectRefusedAs(attempt: Promise<unknown>, code: string): Promise<void> {
  const refused = await attempt.then(
    () => undefined,
    (error: unknown) => (error instanceof ApiError ? error : undefined),
  );
  if (refused?.code !== code) {
    throw new Error(
      `expected the app to refuse with "${code}", but it ${refused ? `refused with "${refused.code}"` : "accepted"}`,
    );
  }
}

/** The Modify agent's session is the same one as before: a follow-up continued it. */
export async function expectSameModifySession(
  app: AppAccess,
  sessionId: string | undefined,
): Promise<void> {
  const now = (await app.sdk.modify.state()).sessionId;
  if (now !== sessionId)
    throw new Error(
      `expected the follow-up to continue session ${String(sessionId)}, but it ran in ${String(now)}`,
    );
}

/** The newest kept version is the update to this default UI version. */
export async function expectUpdateKept(app: AppAccess, version: string): Promise<void> {
  const [newest] = await app.sdk.modify.history();
  const found = newest ? `${newest.kind} ${newest.templateVersion ?? ""}`.trim() : "nothing";
  if (found !== `update ${version}`) {
    throw new Error(
      `expected the newest UI version to be the update to ${version}, but it is ${found}`,
    );
  }
}

/** The failure text the user reads says this. */
export async function expectFailureToSay(app: AppAccess, text: string): Promise<void> {
  const { failure } = await app.sdk.modify.state();
  if (!failure?.includes(text)) {
    throw new Error(`expected the failure to say "${text}", but it says "${failure ?? ""}"`);
  }
}

/** The Modify agent's folder lists this file. */
export function expectFilesToInclude(files: string[], path: string): void {
  if (!files.includes(path))
    throw new Error(`expected the files to include ${path}, but they are: ${files.join(", ")}`);
}

/** No file was created outside the UI folders, in the data folder, with this name. */
export async function expectNoFileInDataFolder(app: AppAccess, name: string): Promise<void> {
  const exists = await access(join(app.dataDir, name)).then(
    () => true,
    () => false,
  );
  if (exists) throw new Error(`expected ${name} not to exist in the data folder, but it does`);
}

async function modifyPrompts(app: AppAccess): Promise<string[]> {
  const { sessionId } = await app.sdk.modify.state();
  const events = sessionId ? await app.sdk.sessions.events(sessionId, { after: 0 }) : [];
  return events.flatMap((event) => (event.kind === "prompt-sent" ? [event.payload.text] : []));
}

/** What the Modify agent was sent contains `including` and never `excluding`. */
export async function expectModifyAgentToldRules(
  app: AppAccess,
  expected: { including: string; excluding: string },
): Promise<void> {
  const sent = (await modifyPrompts(app)).join("\n");
  if (!sent.includes(expected.including) || sent.includes(expected.excluding)) {
    throw new Error(
      `expected the agent's instructions to contain "${expected.including}" and not "${expected.excluding}", but they are: ${sent}`,
    );
  }
}

/** The agent's launch settings, as the session's log shows them, mention this. */
export async function expectModifyAgentLaunchedWith(app: AppAccess, text: string): Promise<void> {
  const { sessionId } = await app.sdk.modify.state();
  const events = sessionId ? await app.sdk.sessions.events(sessionId, { after: 0 }) : [];
  if (!JSON.stringify(events).includes(text)) {
    throw new Error(
      `expected the Modify agent to be launched with "${text}", but its log does not show it`,
    );
  }
}

/** The Modify agent has started its session and is working on the request. */
export async function expectModifyAgentWorking(app: AppAccess): Promise<void> {
  await eventually("expected the Modify agent to be working in a session", async () => {
    const { status, sessionId } = await app.sdk.modify.state();
    return status === "working" && sessionId ? undefined : `it is ${status}`;
  });
}

/** The history has exactly one kept change with this message. */
export async function expectKeptOnce(app: AppAccess, request: string): Promise<void> {
  const versions = await app.sdk.modify.history();
  const times = versions.filter((v) => v.kind === "change" && v.message === request).length;
  if (times !== 1)
    throw new Error(
      `expected "${request}" to be kept once, but it was kept ${String(times)} times`,
    );
}
