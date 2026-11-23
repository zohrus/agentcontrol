import { RelayName as N } from "@agentcontrol/protocol";
import type { Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";
import type { Terminals } from "../terminal/index.ts";

type TerminalMethods =
  | typeof N.terminalOpen
  | typeof N.terminalWrite
  | typeof N.terminalResize
  | typeof N.terminalClose;

/** The methods behind the Terminal tab: open a shell in a session's folder, type, resize, close. */
export function terminalHandlers(options: {
  sessions: Sessions;
  terminals: Terminals;
  /** Awaited after the session's folder is found and before the shell starts; for tests. */
  beforeShellStarts?: () => Promise<void>;
}): Pick<Handlers, TerminalMethods> {
  const { sessions, terminals } = options;
  return {
    [N.terminalOpen]: async ({ sessionId, cols, rows }, client) => {
      const target = await sessions.shellTarget(sessionId);
      await options.beforeShellStarts?.();
      const terminalId = terminals.open({ client, sessionId, target, size: { cols, rows } });
      return { terminalId };
    },
    [N.terminalWrite]: (params, client) => {
      terminals.write({ client, ...params });
      return Promise.resolve({});
    },
    [N.terminalResize]: (params, client) => {
      terminals.resize({ client, ...params });
      return Promise.resolve({});
    },
    [N.terminalClose]: (params, client) => {
      terminals.close({ client, ...params });
      return Promise.resolve({});
    },
  };
}
