import type { SessionId } from "@agentcontrol/protocol";
import { sseMessages } from "./sse.ts";
import type { LiveSessionEvent, ModifyState, SessionRow } from "./types.ts";

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
  /** The Modify agent's state changed (status, changed files, check output, update banner). */
  onModify?: (state: ModifyState) => void;
  /**
   * Called each time the stream (re)connects. After a reconnect, refetch what you show:
   * `sessions.list()` and `sessions.events(id, { after })`, since messages may have been missed.
   */
  onOpen?: () => void;
  /** Called when the stream drops (the app quit or the network failed); it retries every second. */
  onClose?: () => void;
}

type Handlers = Record<string, (data: unknown) => void>;

function handlersOf(listeners: Listeners): Handlers {
  return {
    ready: () => listeners.onOpen?.(),
    event: (data) => listeners.onEvent?.(data as LiveSessionEvent),
    sessions: (data) => listeners.onSessions?.(data as SessionRow[]),
    modify: (data) => listeners.onModify?.(data as ModifyState),
    fs: (data) => {
      listeners.onFilesChanged?.(
        data as { workspaceId: string; sessionId: SessionId; paths: string[] },
      );
    },
  };
}

async function readStream(options: {
  url: string;
  handlers: Handlers;
  signal: AbortSignal;
  send: typeof fetch;
}): Promise<void> {
  const { url, handlers, signal, send } = options;
  const response = await send(url, { signal, headers: { accept: "text/event-stream" } });
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
  listeners: Listeners;
  signal: AbortSignal;
  send: typeof fetch;
  pause: (ms: number) => Promise<void>;
}): Promise<void> {
  const { url, listeners, signal, send, pause } = options;
  const stopped = (): boolean => signal.aborted;
  while (!stopped()) {
    await readStream({ url, handlers: handlersOf(listeners), signal, send }).catch(() => undefined);
    if (!stopped()) listeners.onClose?.();
    await pause(reconnectDelay(signal));
  }
}

/** Opens the live stream and keeps it open, reconnecting after drops. Returns the unsubscribe function. */
export function subscribeTo(options: {
  streamUrl: string;
  listeners: Listeners;
  send: typeof fetch;
}): () => void {
  const abort = new AbortController();
  const { streamUrl: url, listeners, send } = options;
  const { pause, wake } = reconnectPause();
  void keepReading({ url, listeners, signal: abort.signal, send, pause });
  return () => {
    abort.abort();
    wake();
  };
}
