import { SessionId } from "@agentcontrol/protocol";
import type { SessionRow, StartSession } from "@agentcontrol/sdk";
import { type Context, inBackground } from "./context.ts";
import { isCreating, setCreating } from "./pending.ts";
import { keyOf, LOCAL_WORKSPACE, type SessionRef } from "./session-ref.ts";
import { loadSessions } from "./sessions-data.ts";

const lastSegment = (path: string): string => path.split("/").filter(Boolean).at(-1) ?? path;

/** The title the app will give: the one asked for, else the prompt's first line, else the repository's. */
function titleOf(request: StartSession): string {
  const firstLine = (request.prompt?.split("\n")[0] ?? "").slice(0, 80);
  return request.title ?? (firstLine || `${lastSegment(request.repoPath)} – new session`);
}

/** The row the list shows before the app has heard of the session: "starting", titled like the app will. */
function placeholderRow(call: { ref: SessionRef; request: StartSession }): SessionRow {
  const { ref, request } = call;
  return {
    id: ref.id,
    workspaceId: ref.workspaceId,
    agent: request.agent,
    status: "starting",
    title: titleOf(request),
    kind: "worktree",
    repoPath: request.repoPath,
    branch: "",
    baseBranch: request.baseBranch?.trim() ?? "",
    lastSeq: 0,
    createdAt: new Date().toISOString(),
    turnRunning: false,
    pendingPermissions: [],
  };
}

function withoutRow(ctx: Context, ref: SessionRef): void {
  ctx.store.update((s) => ({
    ...s,
    sessions: s.sessions.filter(
      (row) => keyOf({ workspaceId: row.workspaceId, id: row.id }) !== keyOf(ref),
    ),
  }));
}

/** What starting a session gives back at once: where it is, and how it ended. */
type Started = {
  ref: SessionRef;
  /** Resolves true when the app took the session, false when it refused (already reported and rolled back). */
  confirmed: Promise<boolean>;
};

/** The app took the session: from here on it is loaded like any other. */
function confirm(ctx: Context, call: { ref: SessionRef; loadIt: (ref: SessionRef) => void }): void {
  setCreating(ctx, { key: keyOf(call.ref), creating: false });
  call.loadIt(call.ref);
  // The row is the placeholder until the app's own arrives; fetch it now in case the stream is down.
  inBackground(ctx, loadSessions(ctx));
}

/** The session the app made is not the one shown (it lists under its own id): the row goes. */
function rollBackQuietly(ctx: Context, ref: SessionRef): boolean {
  withoutRow(ctx, ref);
  setCreating(ctx, { key: keyOf(ref), creating: false });
  return false;
}

/** The app refused: the session leaves the list again, and the user is told why. */
function rollBack(ctx: Context, call: { ref: SessionRef; error: unknown }): void {
  withoutRow(ctx, call.ref);
  setCreating(ctx, { key: keyOf(call.ref), creating: false });
  ctx.report(call.error);
}

/**
 * Starts a session. It is in the list, and can be opened, in this very call; the app is asked in
 * the background. `loadIt` fetches the session's history and changes once the app has it.
 */
export function startSession(
  ctx: Context,
  call: { request: StartSession; loadIt: (ref: SessionRef) => void },
): Started {
  const { request } = call;
  const ref = {
    workspaceId: request.workspaceId ?? LOCAL_WORKSPACE,
    id: SessionId.parse(crypto.randomUUID()),
  };
  setCreating(ctx, { key: keyOf(ref), creating: true });
  ctx.store.update((s) => ({ ...s, sessions: [placeholderRow({ ref, request }), ...s.sessions] }));
  const confirmed = ctx.client.sessions.start({ ...request, sessionId: ref.id }).then(
    (id) => {
      // A relay that does not take the id (an older one) made another session: the row is not it.
      if (id !== ref.id) return rollBackQuietly(ctx, ref);
      confirm(ctx, { ref, loadIt: call.loadIt });
      return true;
    },
    (error: unknown) => {
      // The app listed the session before the answer failed (it was adopted): it exists.
      if (!isCreating(ctx, keyOf(ref))) return true;
      rollBack(ctx, { ref, error });
      return false;
    },
  );
  return { ref, confirmed };
}
