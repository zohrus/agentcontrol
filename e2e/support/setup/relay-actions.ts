import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { connectToRelay, type RelayClient, stopRelayDaemon } from "./relay-client.ts";
import type { Session } from "./relay.ts";

/** Where the relay lives and how the app reaches it. */
export interface RelayHome {
  dataDir: string;
  repoPath: string;
  env: Record<string, string>;
}

function connectApp(home: RelayHome): RelayClient {
  const client = connectToRelay({ dataDir: home.dataDir, env: home.env });
  onTestEnd(() => client.disconnect());
  return client;
}

/** The app's current connection; closing and opening replaces it, the relay carries on. */
function appConnection(home: RelayHome) {
  let app = connectApp(home);
  return {
    current: () => app,
    reconnect: (): void => {
      app = connectApp(home);
    },
  };
}

/** What a person does to the app and the relay around the connection, as relay calls. */
export function actionsOf(home: RelayHome) {
  const connection = appConnection(home);
  const { current } = connection;
  return {
    current,
    follow: (): Promise<unknown> => current().call(RelayName.eventsSubscribe, { afterSeq: {} }),
    closesTheApp: () => current().disconnect(),
    opensTheApp: connection.reconnect,
    restartsTheRelay: async (): Promise<void> => {
      await current().disconnect();
      await stopRelayDaemon(home.dataDir);
      connection.reconnect();
    },
    followsSessionAfter: async (session: Session, afterSeq: number) => {
      await current().call(RelayName.eventsSubscribe, { sessionId: session.id, afterSeq });
    },
    repoSetupScriptIs: async (script: string) => {
      const repo = await current().call(RelayName.reposAdd, { path: home.repoPath });
      const setup = { copyFiles: [".env*"], setupScript: script };
      await current().call(RelayName.reposSetSetup, { repoId: repo.repoId, setup });
    },
  };
}
