import {
  ErrorCode,
  limitedOutput,
  RelayName as N,
  type SessionId,
  type TerminalId,
} from "@agentcontrol/protocol";
import { type Client, RelayError } from "../rpc/index.ts";
import { type HostEnvironment, loginShell, shellEnvironment } from "./environment.ts";
import { type ShellProcess, spawnShell } from "./shell-process.ts";

/** Where a terminal starts and what its shell inherits from the session. */
interface ShellTarget {
  cwd: string;
  /** The session's own variables (its ports). */
  env: Record<string, string>;
}

interface Terminal {
  owner: Client;
  sessionId: SessionId;
  shell: ShellProcess;
}

type Size = { cols: number; rows: number };

/** The open terminals of one relay. A terminal belongs to the client that opened it. */
export interface Terminals {
  /** Starts the user's login shell in the target's folder; its output follows as notifications. */
  open(call: { client: Client; sessionId: SessionId; target: ShellTarget; size: Size }): TerminalId;
  write(call: { client: Client; terminalId: TerminalId; data: string }): void;
  resize(call: { client: Client; terminalId: TerminalId } & Size): void;
  /** Ends the shell; its client is still told it exited. */
  close(call: { client: Client; terminalId: TerminalId }): void;
  /** Ends every terminal of the session (it was archived); resolves once they are gone. */
  closeSession(sessionId: SessionId): Promise<void>;
  /** Ends every terminal (the relay is stopping); resolves once they are gone. */
  closeAll(): Promise<void>;
}

/** The most terminals one client may hold open at once. */
const MAX_TERMINALS_PER_CLIENT = 8;

type Registry = Map<TerminalId, Terminal>;

function terminalOf(call: { registry: Registry; client: Client; terminalId: TerminalId }) {
  const terminal = call.registry.get(call.terminalId);
  if (terminal?.owner !== call.client) {
    throw new RelayError(ErrorCode.terminalNotFound, `No terminal "${call.terminalId}".`);
  }
  return terminal;
}

function refuseTooMany(registry: Registry, client: Client): void {
  const held = [...registry.values()].filter((terminal) => terminal.owner === client).length;
  if (held < MAX_TERMINALS_PER_CLIENT) return;
  const message = `At most ${String(MAX_TERMINALS_PER_CLIENT)} terminals can be open at once.`;
  throw new RelayError(ErrorCode.invalidParams, message);
}

/** What the shell prints, passed to the client as long as the client keeps up with it. */
function outputTo(call: { client: Client; terminalId: TerminalId }): (text: string) => void {
  const { client, terminalId } = call;
  return limitedOutput({
    unread: () => client.backlog(),
    send: (data) => {
      client.notify(N.terminalData, { terminalId, data });
    },
  });
}

function startShell(call: {
  host: HostEnvironment;
  client: Client;
  terminalId: TerminalId;
  target: ShellTarget;
  size: Size;
  onExit: () => void;
}): ShellProcess {
  const { client, terminalId, target } = call;
  try {
    return spawnShell({
      command: loginShell(call.host),
      cwd: target.cwd,
      env: shellEnvironment({ host: call.host, session: target.env }),
      ...call.size,
      onData: outputTo({ client, terminalId }),
      onExit: (exitCode) => {
        call.onExit();
        client.notify(N.terminalExit, { terminalId, exitCode });
      },
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new RelayError(ErrorCode.internalError, `Could not start a shell: ${reason}`);
  }
}

/** Starts a shell for the client and remembers it; it ends with the client's connection. */
function openTerminal(call: {
  registry: Registry;
  host: HostEnvironment;
  client: Client;
  sessionId: SessionId;
  target: ShellTarget;
  size: Size;
}): TerminalId {
  const { registry, host, client, sessionId, target, size } = call;
  refuseTooMany(registry, client);
  const terminalId = crypto.randomUUID();
  const onExit = (): void => {
    registry.delete(terminalId);
  };
  const shell = startShell({ host, client, terminalId, target, size, onExit });
  registry.set(terminalId, { owner: client, sessionId, shell });
  // The connection going away ends its terminals: no shell outlives the client that opened it.
  client.onClose(() => {
    void shell.stop();
  });
  return terminalId;
}

async function stopWhere(registry: Registry, matches: (terminal: Terminal) => boolean) {
  const chosen = [...registry.values()].filter(matches);
  await Promise.all(chosen.map((terminal) => terminal.shell.stop()));
  await Promise.all(chosen.map((terminal) => terminal.shell.finished));
}

/** The terminals of one relay; each runs the user's login shell in a pseudo-terminal. */
export function createTerminals(options: { hostEnv: HostEnvironment }): Terminals {
  const registry: Registry = new Map();
  return {
    open: (call) => openTerminal({ ...call, registry, host: options.hostEnv }),
    write: ({ client, terminalId, data }) => {
      terminalOf({ registry, client, terminalId }).shell.write(data);
    },
    resize: ({ client, terminalId, ...size }) => {
      terminalOf({ registry, client, terminalId }).shell.resize(size);
    },
    close: ({ client, terminalId }) => {
      void terminalOf({ registry, client, terminalId }).shell.stop();
    },
    closeSession: (sessionId) =>
      stopWhere(registry, (terminal) => terminal.sessionId === sessionId),
    closeAll: () => stopWhere(registry, () => true),
  };
}
