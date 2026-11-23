import type { SessionId } from "@agentcontrol/sdk";
import { useCallback, useEffect, useState } from "react";
import { describeError, useController } from "../data/index.ts";
import { touchesPage } from "./kind.ts";

const SETTLE_MS = 250;

/** Where the page is, once the app has handed out a preview address for it. */
export type PreviewAddress =
  | { state: "loading" }
  | { state: "ready"; url: string }
  | { state: "failed"; message: string };

/** Runs `action` once, `ms` after the last call to `run`; `cancel` drops a call that is waiting. */
function settling(action: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    run: (): void => {
      clearTimeout(timer);
      timer = setTimeout(action, ms);
    },
    cancel: (): void => {
      clearTimeout(timer);
    },
  };
}

/**
 * A number that goes up (after a short pause, so a burst of edits counts once) whenever a change
 * to the session's files could alter the page.
 */
export function useChangesToPage(call: { id: SessionId; path: string }): number {
  const controller = useController();
  const [count, setCount] = useState(0);
  const { id, path } = call;
  const bump = useCallback(() => {
    setCount((now) => now + 1);
  }, []);
  useEffect(() => {
    const settle = settling(bump, SETTLE_MS);
    const stop = controller.watchFileChanges((change) => {
      if (change.sessionId === id && touchesPage(change.paths, path)) settle.run();
    });
    return () => {
      stop();
      settle.cancel();
    };
  }, [controller, id, path, bump]);
  return count;
}

/**
 * The preview address of a file. It is fetched again whenever `version` changes, and the old
 * address stays in place until the new one arrives, so the page does not flash empty.
 */
export function usePreviewAddress(call: {
  id: SessionId;
  path: string;
  version: number;
}): PreviewAddress {
  const controller = useController();
  const [address, setAddress] = useState<PreviewAddress>({ state: "loading" });
  const { id, path, version } = call;
  useEffect(() => {
    let current = true;
    controller.previewUrl(id, path).then(
      (url) => {
        if (current) setAddress({ state: "ready", url });
      },
      (error: unknown) => {
        if (current) setAddress({ state: "failed", message: describeError(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [controller, id, path, version]);
  return address;
}
