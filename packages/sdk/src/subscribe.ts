import type { SessionEvent, SessionId, SessionSummary } from "@agentcontrol/protocol";
import { sseMessages } from "./sse.ts";

const RECONNECT_MS = 1000;

export interface Listeners {
  /** One new session event, as it happens. */
  onEvent?: (event: SessionEvent) => void;
  /** Summaries of sessions whose status or details changed. */
  onSessions?: (sessions: SessionSummary[]) => void;
  /** Paths changed in a session's worktree (after `files.tree(id)` has been called for it). */
  onFilesChanged?: (change: { sessionId: SessionId; paths: string[] }) => void;
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
    event: (data) => listeners.onEvent?.(data as SessionEvent),
    sessions: (data) => listeners.onSessions?.(data as SessionSummary[]),
    fs: (data) => listeners.onFilesChanged?.(data as { sessionId: SessionId; paths: string[] }),
  };
}

async function readStream(url: string, handlers: Handlers, signal: AbortSignal): Promise<void> {
  const response = await fetch(url, { signal, headers: { accept: "text/event-stream" } });
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

async function keepReading(url: string, handlers: Handlers, signal: AbortSignal): Promise<void> {
  while (!signal.aborted) {
    await readStream(url, handlers, signal).catch(() => undefined);
    await pause(RECONNECT_MS, signal);
  }
}

/** Opens the live stream and keeps it open, reconnecting after drops. Returns the unsubscribe function. */
export function subscribeTo(streamUrl: string, listeners: Listeners): () => void {
  const abort = new AbortController();
  void keepReading(streamUrl, handlersOf(listeners), abort.signal);
  return () => {
    abort.abort();
  };
}
