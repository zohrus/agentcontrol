import type { AppAccess, Session } from "../setup/app.ts";
import { eventually } from "../setup/eventually.ts";
import { producedByCodeServer } from "../setup/ide-downloads.ts";
import {
  codeServersStartedBy,
  type FakeInvocation,
  type IdeSocket,
  type IdeTab,
} from "../setup/ide-user.ts";
import { worktreeOf } from "./terminal-expectations.ts";

/** The page the IDE serves at its address shows the folder it was opened on. */
async function expectWorkbenchOnFolder(tab: IdeTab, folder: string): Promise<void> {
  const page = await tab.loads("");
  const html = await page.text();
  if (page.status !== 200 || !html.includes(`id="folder">${folder}<`)) {
    throw new Error(
      `expected the IDE to serve its page on the folder ${folder}, but it answered ${String(page.status)}: ${html.slice(0, 200)}`,
    );
  }
}

/** The IDE opened on the session's own worktree (not the repository, not another session's). */
export async function expectWorkbenchOnTheWorktreeOf(
  call: { app: AppAccess; tab: IdeTab },
  session: Session,
): Promise<void> {
  await expectWorkbenchOnFolder(call.tab, await worktreeOf(call.app, session));
}

/** A path under the IDE's address answers with exactly this status. */
export async function expectIdeToAnswer(
  tab: IdeTab,
  call: { path: string; status: number },
): Promise<void> {
  await eventually(
    `expected "${call.path}" on the IDE to answer ${String(call.status)}`,
    async () => {
      const answer = await tab.loads(call.path);
      return answer.status === call.status ? undefined : `it answered ${String(answer.status)}`;
    },
  );
}

/** The IDE serves this static file with this text in it. */
export async function expectIdeFileToContain(
  tab: IdeTab,
  call: { path: string; text: string },
): Promise<void> {
  const answer = await tab.loads(call.path);
  const body = await answer.text();
  if (!body.includes(call.text)) {
    throw new Error(
      `expected "${call.path}" on the IDE to contain "${call.text}", but it said ${body.slice(0, 200)}`,
    );
  }
}

/** The socket opened and code-server answers a text message with the same text. */
export async function expectSocketToEchoText(socket: IdeSocket, text: string): Promise<void> {
  await socket.openings.waitFor(
    (opened) => "protocol" in opened,
    "expected the IDE's WebSocket to open",
  );
  socket.sendsText(text);
  await socket.texts.waitFor((heard) => heard === text, `expected the text "${text}" to come back`);
}

/** The socket opened and code-server answers binary data with the same bytes. */
export async function expectSocketToEchoBytes(socket: IdeSocket, bytes: number[]): Promise<void> {
  await socket.openings.waitFor(
    (opened) => "protocol" in opened,
    "expected the IDE's WebSocket to open",
  );
  socket.sendsBytes(bytes);
  await socket.binaries.waitFor(
    (heard) => heard.join() === bytes.join(),
    `expected the bytes ${bytes.join(",")} to come back`,
  );
}

/** The socket was opened with the subprotocol the page offered. */
export async function expectSocketToUseSubprotocol(
  socket: IdeSocket,
  protocol: string,
): Promise<void> {
  await socket.openings.waitFor(
    (opened) => "protocol" in opened && opened.protocol === protocol,
    `expected the WebSocket to be opened with the subprotocol "${protocol}"`,
  );
}

/** The relay's folder says this many code-servers were started (and each wrote down how). */
export async function expectCodeServersStarted(relayDataDir: string, count: number) {
  await eventually(`expected ${String(count)} code-server(s) to have been started`, async () => {
    const started = await codeServersStartedBy(relayDataDir);
    return started.length === count ? undefined : `${String(started.length)} were`;
  });
  return codeServersStartedBy(relayDataDir);
}

/**
 * Code-server stops producing a download nobody reads: the number it produced stops growing and
 * stays under this many megabytes (what the tunnel and the sockets between hold).
 */
export async function expectProductionToStallBelow(tab: IdeTab, megabytes: number): Promise<void> {
  let last = -1;
  let produced = await producedByCodeServer(tab);
  while (produced !== last) {
    last = produced;
    await Bun.sleep(400);
    produced = await producedByCodeServer(tab);
  }
  if (produced > megabytes * 1024 * 1024) {
    throw new Error(
      `expected code-server to be held back below ${String(megabytes)} MB, but it produced ${(produced / 1024 / 1024).toFixed(1)} MB for a reader that reads nothing`,
    );
  }
}

/** Exactly one code-server was started, and this is how. */
export async function expectOneCodeServerStarted(relayDataDir: string): Promise<FakeInvocation> {
  const [only] = await expectCodeServersStarted(relayDataDir, 1);
  if (only === undefined) throw new Error("expected one code-server to have been started");
  return only;
}

/** The WebSocket was refused before it opened. */
export async function expectSocketToBeRefused(socket: IdeSocket): Promise<void> {
  await socket.openings.waitFor(
    (opened) => "refused" in opened,
    "expected the WebSocket to be refused",
  );
}

/** The WebSocket ended with this close code (the one code-server gave, or 1011 when the link broke). */
export async function expectSocketToEndWith(socket: IdeSocket, code: number): Promise<void> {
  await socket.endings.waitFor(
    (ended) => ended.code === code,
    `expected the WebSocket to end with the close code ${String(code)}`,
  );
}
