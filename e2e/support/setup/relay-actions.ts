import { RelayName } from "@agentcontrol/protocol";
import { onTestEnd } from "./cleanup.ts";
import { connectToRelay, type RelayClient } from "./relay-client.ts";
import type { RelayHost } from "./relay-host.ts";
import type { Session } from "./relay.ts";

/** Where the relay lives and how the app reaches it. */
export interface RelayHome {
  host: RelayHost;
  repoPath: string;
}

function connectApp(home: RelayHome): RelayClient {
  const client = connectToRelay(home.host.wire());
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

async function setUpRepo(call: { home: RelayHome; client: RelayClient; script: string }) {
  const { home, client, script } = call;
  const repo = await client.call(RelayName.reposAdd, { path: home.repoPath });
  const setup = { copyFiles: [".env*"], setupScript: script };
  await client.call(RelayName.reposSetSetup, { repoId: repo.repoId, setup });
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
    /** Stops the relay and starts it again; `whileDown` may change what it left on disk. */
    restartsTheRelay: async (options: { whileDown?: () => Promise<void> } = {}): Promise<void> => {
      await current().disconnect();
      await home.host.stop();
      await options.whileDown?.();
      await home.host.start();
      connection.reconnect();
    },
    /** Stops the relay while the app is still connected, as when the machine shuts down. */
    stopsTheRelayWhileTheAppIsConnected: () => home.host.stop(),
    /** Starts the relay again and connects the app to it. */
    startsTheRelayAndConnectsTheApp: async (): Promise<void> => {
      await home.host.start();
      connection.reconnect();
    },
    followsSessionAfter: async (session: Session, afterSeq: number) => {
      await current().call(RelayName.eventsSubscribe, { sessionId: session.id, afterSeq });
    },
    repoSetupScriptIs: (script: string) => setUpRepo({ home, client: current(), script }),
  };
}
