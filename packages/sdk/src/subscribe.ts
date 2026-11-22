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
  /** Called when the stream drops (the app quit or the network failed); it retries every second. */
  onClose?: () => void;
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

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function keepReading(options: {
  url: string;
  listeners: Listeners;
  signal: AbortSignal;
  send: typeof fetch;
}): Promise<void> {
  const { url, listeners, signal, send } = options;
  const stopped = (): boolean => signal.aborted;
  while (!stopped()) {
    await readStream({ url, handlers: handlersOf(listeners), signal, send }).catch(() => undefined);
    if (!stopped()) listeners.onClose?.();
    await pause(RECONNECT_MS, signal);
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
  void keepReading({ url, listeners, signal: abort.signal, send });
  return () => {
    abort.abort();
  };
}
