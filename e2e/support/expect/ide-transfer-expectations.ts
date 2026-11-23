import type { IdeDownload } from "../setup/ide-downloads.ts";
import type { IdeTab } from "../setup/ide-user.ts";

/** The download reads on to its end: this many megabytes, every byte as code-server wrote it. */
export async function expectDownloadToArriveWhole(
  download: IdeDownload,
  megabytes: number,
): Promise<void> {
  const { bytes, allExpected } = await download.readsOn();
  const wanted = megabytes * 1024 * 1024;
  if (bytes !== wanted || !allExpected) {
    throw new Error(
      `expected a download of ${String(wanted)} unchanged bytes, but ${String(bytes)} arrived${allExpected ? "" : " and some were wrong"}`,
    );
  }
}

/** Posting random bytes to the echo path gives the same bytes back (and status 201). */
export async function expectEchoToReturnTheUpload(tab: IdeTab, size: number): Promise<void> {
  const sent = crypto.getRandomValues(new Uint8Array(size));
  const answer = await tab.loads("echo", { method: "POST", body: sent });
  const received = new Uint8Array(await answer.arrayBuffer());
  const same = received.length === sent.length && received.every((byte, at) => byte === sent[at]);
  if (answer.status !== 201 || !same) {
    throw new Error(
      `expected the ${String(size)} uploaded bytes to come back unchanged, but got status ${String(answer.status)} and ${String(received.length)} bytes${same ? "" : " that differ"}`,
    );
  }
}
