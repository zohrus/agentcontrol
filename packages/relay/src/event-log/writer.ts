import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { SessionEvent, SessionId } from "@agentcontrol/protocol";
import { endsMidLine, scanEvents, sessionFile } from "./files.ts";
import type { EventInput } from "./types.ts";

interface SessionState {
  lastSeq: number;
  /** The file ends in a truncated line, so the next write must start on a fresh line. */
  needsNewline: boolean;
}

type Listener = (event: SessionEvent) => void;

interface WriterContext {
  dir: string;
  now: () => Date;
  states: Map<SessionId, SessionState>;
  queues: Map<SessionId, Promise<unknown>>;
  listeners: Set<Listener>;
}

async function recover(file: string): Promise<SessionState> {
  let lastSeq = 0;
  for await (const event of scanEvents(file)) lastSeq = Math.max(lastSeq, event.seq);
  return { lastSeq, needsNewline: await endsMidLine(file) };
}

async function stateOf(ctx: WriterContext, sessionId: SessionId): Promise<SessionState> {
  const known = ctx.states.get(sessionId);
  if (known) return known;
  const state = await recover(sessionFile(ctx.dir, sessionId));
  ctx.states.set(sessionId, state);
  return state;
}

function notify(listeners: Set<Listener>, event: SessionEvent): void {
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      // A faulty listener must not affect appends or other listeners.
    }
  }
}

async function write(
  ctx: WriterContext,
  sessionId: SessionId,
  input: EventInput,
): Promise<SessionEvent> {
  const file = sessionFile(ctx.dir, sessionId);
  const state = await stateOf(ctx, sessionId);
  const meta = { sessionId, seq: state.lastSeq + 1, ts: input.ts ?? ctx.now().toISOString() };
  const event: SessionEvent = { ...input, ...meta };
  await mkdir(dirname(file), { recursive: true });
  await appendFile(file, `${state.needsNewline ? "\n" : ""}${JSON.stringify(event)}\n`);
  state.lastSeq = event.seq;
  state.needsNewline = false;
  notify(ctx.listeners, event);
  return event;
}

/** Runs a task after everything already queued for the session, whatever its outcome. */
function whenIdle<T>(ctx: WriterContext, sessionId: SessionId, task: () => Promise<T>): Promise<T> {
  const run = (ctx.queues.get(sessionId) ?? Promise.resolve()).then(task, task);
  ctx.queues.set(sessionId, run);
  return run;
}

/** Serialized per-session appends with lazily recovered sequence numbers and listeners. */
export function createWriter(options: { dir: string; now: () => Date }) {
  const ctx: WriterContext = {
    ...options,
    states: new Map(),
    queues: new Map(),
    listeners: new Set(),
  };
  return {
    whenIdle: <T>(sessionId: SessionId, task: () => Promise<T>) => whenIdle(ctx, sessionId, task),
    append: (sessionId: SessionId, input: EventInput) =>
      whenIdle(ctx, sessionId, () => write(ctx, sessionId, input)),
    lastSeq: (sessionId: SessionId) =>
      whenIdle(ctx, sessionId, async () => (await stateOf(ctx, sessionId)).lastSeq),
    subscribe(listener: Listener): () => void {
      ctx.listeners.add(listener);
      return () => {
        ctx.listeners.delete(listener);
      };
    },
  };
}
