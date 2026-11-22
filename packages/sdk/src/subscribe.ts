import type { SessionId } from "@agentcontrol/protocol";
import { sseMessages } from "./sse.ts";
import type { LiveSessionEvent, SessionRow } from "./types.ts";

const RECONNECT_MS = 1000;

export interface Listeners {
  /** One new session event, as it happens, with the workspace the session lives in. */
  onEvent?: (event: LiveSessionEvent) => void;
  /**
   * Sessions whose status or details changed, pushed as they change: a session that starts waiting
   * for approval arrives here with its `pendingPermissions`, and one whose turn starts or ends with
   * `turnRunning` flipped. No polling needed; after a reconnect call `sessions.list()` once.
   */
  onSessions?: (sessions: SessionRow[]) => void;
  /** Paths changed in a session's worktree (after `files.tree(id)` has been called for it). */
  onFilesChanged?: (change: { workspaceId: string; sessionId: SessionId; paths: string[] }) => void;
  /**
   * Called each time the stream (re)connects. After a reconnect, refetch what you show:
   * `sessions.list()` and `sessions.events(id, { after })`, since messages may have been missed.
   */
  onOpen?: () => void;
}

type Handlers = Record<string, (data: unknown) => void>;

function handlersOf(listeners: Listeners): Handlers {
  return {
    ready: () => listeners.onOpen?.(),
    event: (data) => listeners.onEvent?.(data as LiveSessionEvent),
    sessions: (data) => listeners.onSessions?.(data as SessionRow[]),
    fs: (data) => {
      listeners.onFilesChanged?.(
        data as { workspaceId: string; sessionId: SessionId; paths: string[] },
      );
    },
  };
}

async function readStream(url: string, handlers: Handlers, signal: AbortSignal): Promise<void> {
  const response = await fetch(url, { signal, headers: { accept: "text/event-stream" } });
  if (!response.ok || response.body === null) return;
  for await (const message of sseMessages(response.body)) {
    handlers[message.event]?.(JSON.parse(message.data));
  }
}

/** A reconnect pause that can be cut short: `wake` ends it now and clears its timer. */
function reconnectPause() {
  let wake = (): void => undefined;
  const pause = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      wake = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  return {
    pause,
    wake: () => {
      wake();
    },
  };
}

/** No wait at all once unsubscribed, so no timer is left behind. */
const reconnectDelay = (signal: AbortSignal): number => (signal.aborted ? 0 : RECONNECT_MS);

async function keepReading(options: {
  url: string;
  handlers: Handlers;
  signal: AbortSignal;
  pause: (ms: number) => Promise<void>;
}): Promise<void> {
  const { url, handlers, signal, pause } = options;
  while (!signal.aborted) {
    await readStream(url, handlers, signal).catch(() => undefined);
    await pause(reconnectDelay(signal));
  }
}

/** Opens the live stream and keeps it open, reconnecting after drops. Returns the unsubscribe function. */
export function subscribeTo(streamUrl: string, listeners: Listeners): () => void {
  const abort = new AbortController();
  const { pause, wake } = reconnectPause();
  void keepReading({
    url: streamUrl,
    handlers: handlersOf(listeners),
    signal: abort.signal,
    pause,
  });
  return () => {
    abort.abort();
    wake();
  };
}
