import { get, type IncomingMessage } from "node:http";
import type { IdeTab } from "./ide-user.ts";

/** A download the page started from code-server, read as slowly or as fast as the test wants. */
export interface IdeDownload {
  /** Resolves once the first piece arrived and reading stopped (a tab that is busy). */
  readonly paused: Promise<void>;
  /** Reads the rest and resolves with the number of bytes that came in all, and whether all were `a`. */
  readsOn(): Promise<{ bytes: number; allExpected: boolean }>;
  /** Closes the connection, as closing the tab does. */
  givesUp(): void;
}

/** Reads the first piece of the download, then stops reading. */
function readFirstPiece(call: {
  address: string;
  count: (chunk: Buffer) => void;
  into: { response?: IncomingMessage; finished: Promise<void> };
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const request = get(call.address, (incoming) => {
      call.into.response = incoming;
      call.into.finished = new Promise<void>((done) => incoming.once("close", done));
      incoming.once("data", (chunk: Buffer) => {
        call.count(chunk);
        incoming.pause();
        resolve();
      });
    });
    request.on("error", reject);
  });
}

/**
 * Starts a download of this many megabytes and reads its first piece only: then the response is
 * paused, as a browser tab that is busy does, until `readsOn` is called.
 */
export function startsDownload(tab: IdeTab, megabytes: number): IdeDownload {
  const seen = { bytes: 0, allExpected: true };
  const count = (chunk: Buffer): void => {
    seen.bytes += chunk.length;
    seen.allExpected &&= chunk.every((byte) => byte === 97);
  };
  const into: { response?: IncomingMessage; finished: Promise<void> } = {
    finished: Promise.resolve(),
  };
  const address = `${tab.url}big?mb=${String(megabytes)}`;
  return {
    paused: readFirstPiece({ address, count, into }),
    readsOn: async () => {
      into.response?.on("data", count);
      into.response?.resume();
      await into.finished;
      return seen;
    },
    givesUp: () => {
      into.response?.destroy();
    },
  };
}

/** How many bytes of streamed downloads code-server has produced so far. */
export async function producedByCodeServer(tab: IdeTab): Promise<number> {
  return Number(await (await tab.loads("sent")).text());
}
