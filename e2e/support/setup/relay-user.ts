import { join } from "node:path";
import { RelayName } from "@agentcontrol/protocol";
import type { SessionEvent } from "@agentcontrol/protocol";
import { editorUserOf } from "./editor-user.ts";
import { git } from "./git.ts";
import { optionOfKind } from "./permission-option.ts";
import type { RelayAccess, Session } from "./relay.ts";
import { refusedUserOf } from "./relay-refused-user.ts";
import { resumeUserOf } from "./relay-resume-user.ts";
import { forSession, worktreeOf } from "./session-events.ts";

type PermissionRequest = Extract<SessionEvent, { kind: "permission-requested" }>;

const isRequestFor = (session: Session) => forSession(session, "permission-requested");

async function answer(relay: RelayAccess, call: { session: Session; kind: string }): Promise<void> {
  const { session } = call;
  const event = await relay.events.waitFor(
    isRequestFor(session),
    `expected session "${session.title}" to ask for permission before the user answers`,
  );
  const { requestId, options } = (event as PermissionRequest).payload;
  const optionId = optionOfKind(options, call.kind, session.title);
  await relay.call(RelayName.permissionRespond, { sessionId: session.id, requestId, optionId });
}

async function commit(worktree: string, file: { path: string; content: string }): Promise<void> {
  await Bun.write(join(worktree, file.path), file.content);
  await git(worktree, "add", file.path);
  await git(worktree, "commit", "-m", `Update ${file.path}`);
}

/** The things a person does with a session in the app, as relay calls. */
function sessionUserOf(relay: RelayAccess) {
  return {
    /**
     * Starts a session on the local repo; the first prompt is sent once the agent is up. With
     * `agent: "claude-code"` the relay's Claude Code command must point at the mock agent.
     */
    startsSession: async (options: {
      prompt: string;
      agent?: "mock" | "claude-code";
    }): Promise<Session> => {
      await relay.mockAgent.writeScript();
      const { sessionId } = await relay.call(RelayName.sessionsCreate, {
        agent: options.agent ?? "mock",
        repoPath: relay.repoPath,
        baseBranch: "main",
        prompt: options.prompt,
      });
      return { id: sessionId, title: options.prompt };
    },
    allowsTheCommand: (session: Session) => answer(relay, { session, kind: "allow_once" }),
    rejectsTheCommand: (session: Session) => answer(relay, { session, kind: "reject_once" }),
    sendsMessage: async (session: Session, text: string): Promise<void> => {
      await relay.call(RelayName.prompt, { sessionId: session.id, text });
    },
  };
}

/** What a person does to a session's turn and life: wait, cancel, archive, commit by hand. */
function sessionLifeOf(relay: RelayAccess) {
  return {
    /** Waits until the agent has ended its current turn. */
    waitsForTheAgentToFinish: async (session: Session): Promise<void> => {
      await relay.events.waitFor(
        forSession(session, "turn-ended"),
        `expected the agent of session "${session.title}" to finish its turn`,
      );
    },
    cancelsTheTurn: async (session: Session): Promise<void> => {
      await relay.events.waitFor(
        forSession(session, "prompt-sent"),
        `expected the agent of session "${session.title}" to be given its prompt before cancelling`,
      );
      await relay.call(RelayName.cancel, { sessionId: session.id });
    },
    archivesSession: (session: Session) =>
      relay.call(RelayName.sessionsArchive, { sessionId: session.id }),
    archivesSessionAnyway: (session: Session) =>
      relay.call(RelayName.sessionsArchive, { sessionId: session.id, force: true }),
    /** Commits a file change on the session's branch, as a person would from a terminal. */
    commitsInTheWorktree: async (session: Session, file: { path: string; content: string }) => {
      await commit(await worktreeOf(relay, session), file);
    },
  };
}

/** The things a person does in the app, as relay calls. Extend this when a test needs a new one. */
export function userOf(relay: RelayAccess) {
  return {
    ...sessionUserOf(relay),
    ...sessionLifeOf(relay),
    ...editorUserOf(relay),
    ...refusedUserOf(relay),
    ...resumeUserOf(relay),
  };
}

export type User = ReturnType<typeof userOf>;
