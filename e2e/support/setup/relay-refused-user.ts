import { RelayName } from "@agentcontrol/protocol";
import { startRelayDaemon } from "@agentcontrol/relay";
import { attempt } from "./attempt.ts";
import type { RelayAccess, Session } from "./relay.ts";

/** Calls the relay has to refuse: unknown sessions, requests and methods, bad parameters. */
function refusedCallsOf(relay: RelayAccess) {
  return {
    triesToSendMessage: (session: Session, text: string) =>
      attempt(relay.call(RelayName.prompt, { sessionId: session.id, text })),
    triesToAnswerARequestThatIsNotWaiting: (session: Session) =>
      attempt(
        relay.call(RelayName.permissionRespond, {
          sessionId: session.id,
          requestId: "never-asked",
          optionId: "allow_once",
        }),
      ),
    triesToCallAMethodTheRelayDoesNotHave: () => attempt(relay.request("relay/make-coffee", {})),
    triesToStartASessionWithoutSayingWhere: () =>
      attempt(relay.request(RelayName.sessionsCreate, {})),
  };
}

/** Lines the relay cannot make sense of, and repos it cannot use. */
function refusedInputOf(relay: RelayAccess) {
  return {
    sendsALineThatIsNotJson: () => {
      relay.sendLine("this is not json");
    },
    sendsAMessageThatIsNotARequest: () => {
      relay.sendLine('{"jsonrpc":"2.0","id":1}');
    },
    triesToAddRepo: (path: string) => attempt(relay.call(RelayName.reposAdd, { path })),
    triesToSetupARepoThatIsNotRegistered: () =>
      attempt(
        relay.request(RelayName.reposSetSetup, {
          repoId: crypto.randomUUID(),
          setup: { copyFiles: [] },
        }),
      ),
  };
}

/** Starts another relay on the folder this one already serves; says why if it is refused. */
async function triesToStartASecondRelay(
  relay: RelayAccess,
): Promise<{ started: boolean; message: string }> {
  const second = await startRelayDaemon({ dataDir: relay.dataDir }).catch((error: unknown) =>
    error instanceof Error ? error : new Error(String(error)),
  );
  if (second instanceof Error) return { started: false, message: second.message };
  await second.stop();
  return { started: true, message: "" };
}

/** What a person (or a buggy app) does that the relay has to refuse, as relay calls. */
export function refusedUserOf(relay: RelayAccess) {
  return {
    ...refusedCallsOf(relay),
    ...refusedInputOf(relay),
    triesToStartASecondRelay: () => triesToStartASecondRelay(relay),
  };
}
