import { RelayName as N, type SessionId } from "@agentcontrol/protocol";
import type { Ide } from "../ide/index.ts";
import type { Handlers } from "../rpc/index.ts";
import type { Sessions } from "../sessions/index.ts";

type LifecycleMethods = typeof N.ideStatus | typeof N.ideStart | typeof N.ideStop;
type TunnelMethods =
  | typeof N.ideRequest
  | typeof N.ideAck
  | typeof N.ideClose
  | typeof N.ideSocketOpen
  | typeof N.ideSocketSend;

interface Parts {
  sessions: Sessions;
  ide: Ide;
}

/** Starts the session's code-server unless one runs; an archived session has no folder and fails. */
async function ensureRunning(parts: Parts, sessionId: SessionId): Promise<void> {
  const { sessions, ide } = parts;
  if (ide.isRunning(sessionId)) return;
  const { cwd, env } = await sessions.shellTarget(sessionId);
  await ide.start({ sessionId, folder: cwd, env });
}

function lifecycleHandlers(parts: Parts): Pick<Handlers, LifecycleMethods> {
  const { ide } = parts;
  return {
    [N.ideStatus]: ({ sessionId }) => ide.status(sessionId),
    [N.ideStart]: async ({ sessionId }) => {
      await ensureRunning(parts, sessionId);
      return {};
    },
    [N.ideStop]: async ({ sessionId }) => {
      await ide.stop(sessionId);
      return {};
    },
  };
}

/** A request after the server ended (idle) starts it again, so a tab left open keeps working. */
function tunnelHandlers(parts: Parts): Pick<Handlers, TunnelMethods> {
  const { ide } = parts;
  return {
    [N.ideRequest]: async (params, client) => {
      await ensureRunning(parts, params.sessionId);
      return ide.request({ client, params });
    },
    [N.ideAck]: (params, client) => {
      ide.ack({ client, ...params });
      return Promise.resolve({});
    },
    [N.ideClose]: (params, client) => {
      ide.close({ client, ...params });
      return Promise.resolve({});
    },
    [N.ideSocketOpen]: async (params, client) => {
      await ensureRunning(parts, params.sessionId);
      return ide.openSocket({ client, params });
    },
    [N.ideSocketSend]: (params, client) => {
      ide.sendSocket({ client, ...params });
      return Promise.resolve({});
    },
  };
}

/** The methods behind "Open in browser VS Code": a session's code-server and the tunnel into it. */
export function ideHandlers(parts: Parts): Pick<Handlers, LifecycleMethods | TunnelMethods> {
  return { ...lifecycleHandlers(parts), ...tunnelHandlers(parts) };
}
