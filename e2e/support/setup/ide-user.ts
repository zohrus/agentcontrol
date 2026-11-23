import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppAccess, Session } from "./app.ts";
import { Timeline } from "./timeline.ts";

const WAIT_MS = 8000;

/** One WebSocket a page in the browser VS Code holds open. */
export interface IdeSocket {
  /** Text messages, in order. */
  readonly texts: Timeline<string>;
  /** Binary messages, in order, as byte values. */
  readonly binaries: Timeline<number[]>;
  /** The subprotocol the socket was opened with (one entry), or why it was refused. */
  readonly openings: Timeline<{ protocol: string } | { refused: true }>;
  /** How the socket ended (one entry). */
  readonly endings: Timeline<{ code: number }>;
  sendsText(text: string): void;
  sendsBytes(bytes: number[]): void;
  closes(): void;
}

/** A browser tab on the VS Code of one session, reduced to what it sends and hears. */
export interface IdeTab {
  /** The address the app gave: another port than the app's, with the ticket in the path. */
  readonly url: string;
  /** `http://127.0.0.1:<port>`: the IDE's own origin. */
  readonly origin: string;
  /** Requests a path (without a leading slash) under the ticket, as a page of the IDE does. */
  loads(path: string, init?: RequestInit): Promise<Response>;
  opensSocket(path: string, options?: { protocols?: string[] }): IdeSocket;
}

function listen(socket: WebSocket, heard: Omit<IdeSocket, "sendsText" | "sendsBytes" | "closes">) {
  socket.binaryType = "arraybuffer";
  socket.addEventListener("open", () => {
    heard.openings.record({ protocol: socket.protocol });
  });
  socket.addEventListener("error", () => {
    heard.openings.record({ refused: true });
  });
  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") heard.texts.record(event.data);
    else heard.binaries.record([...new Uint8Array(event.data as ArrayBuffer)]);
  });
  socket.addEventListener("close", (event) => {
    heard.endings.record({ code: event.code });
  });
}

function openSocket(address: string, protocols: string[] | undefined): IdeSocket {
  const heard = {
    texts: new Timeline<string>(WAIT_MS),
    binaries: new Timeline<number[]>(WAIT_MS),
    openings: new Timeline<{ protocol: string } | { refused: true }>(WAIT_MS),
    endings: new Timeline<{ code: number }>(WAIT_MS),
  };
  const socket = new WebSocket(address, protocols);
  listen(socket, heard);
  return {
    ...heard,
    sendsText: (text) => {
      socket.send(text);
    },
    sendsBytes: (bytes) => {
      socket.send(new Uint8Array(bytes));
    },
    closes: () => {
      socket.close();
    },
  };
}

/** A tab on an address the app gave out for the IDE. */
export function tabAt(url: string): IdeTab {
  const origin = new URL(url).origin;
  return {
    url,
    origin,
    loads: (path, init) => fetch(`${url}${path}`, init),
    opensSocket: (path, options = {}) =>
      openSocket(`${url.replace("http:", "ws:")}${path}`, options.protocols),
  };
}

/** The user clicks "Open in browser VS Code" for the session: the app starts it and gives an address. */
export async function opensBrowserVsCode(app: AppAccess, session: Session): Promise<IdeTab> {
  return tabAt(await app.sdk.ide.openIde(session.id));
}

/** How a fake code-server was started, as it wrote it down. */
export interface FakeInvocation {
  pid: number;
  helperPid: number;
  argv: string[];
  folder: string;
  cwd: string;
  home: string;
  port: string | undefined;
}

/** Every fake code-server a relay has started, from the notes each wrote in the relay's folder. */
export async function codeServersStartedBy(relayDataDir: string): Promise<FakeInvocation[]> {
  const folder = join(relayDataDir, "ide");
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.startsWith("fake-"));
  const notes = await Promise.all(names.map((name) => readFile(join(folder, name), "utf8")));
  return notes.map((note) => JSON.parse(note) as FakeInvocation);
}
