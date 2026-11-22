import { RelayName } from "@agentcontrol/protocol";
import type { PermissionOption, SessionEvent } from "@agentcontrol/protocol";
import type { RelayAccess, Session } from "./relay.ts";

type PermissionRequest = Extract<SessionEvent, { kind: "permission-requested" }>;

const isRequestFor = (session: Session) => (event: SessionEvent) =>
  event.kind === "permission-requested" && event.sessionId === session.id;

function optionOfKind(options: PermissionOption[], kind: string, title: string): string {
  const option = options.find((candidate) => candidate.kind === kind);
  if (!option) throw new Error(`the agent offered no "${kind}" option for "${title}"`);
  return option.optionId;
}

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

/** The things a person does in the app, as relay calls. Extend this when a test needs a new one. */
export function userOf(relay: RelayAccess) {
  return {
    /** Starts a session on the local repo; the first prompt is sent once the agent is up. */
    startsSession: async (options: { prompt: string }): Promise<Session> => {
      await relay.mockAgent.writeScript();
      const { sessionId } = await relay.call(RelayName.sessionsCreate, {
        agent: "mock",
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

export type User = ReturnType<typeof userOf>;
