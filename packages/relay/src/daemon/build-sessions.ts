import { join } from "node:path";
import type { SessionId } from "@agentcontrol/protocol";
import type { HostEnv } from "../agents/index.ts";
import { createEventLog } from "../event-log/index.ts";
import type { Ide } from "../ide/index.ts";
import type { RepoStore } from "../repos/index.ts";
import { createSessions, type Sessions } from "../sessions/index.ts";
import type { Terminals } from "../terminal/index.ts";

/** The sessions of one relay; archiving one also ends its shells and its code-server. */
export async function buildSessions(options: {
  dataDir: string;
  repos: RepoStore;
  hostEnv: HostEnv;
  terminals: Terminals;
  ide: Ide;
}): Promise<Sessions> {
  const { dataDir, repos, hostEnv, terminals, ide } = options;
  const log = createEventLog({ dir: join(dataDir, "sessions"), now: () => new Date() });
  const worktreesDir = join(dataDir, "worktrees");
  // Archiving ends what a person has open on the folder: shells and the session's code-server.
  const endTerminals = async (sessionId: SessionId): Promise<void> => {
    await Promise.all([terminals.closeSession(sessionId), ide.stop(sessionId)]);
  };
  return createSessions({ log, repos, worktreesDir, hostEnv, endTerminals });
}
