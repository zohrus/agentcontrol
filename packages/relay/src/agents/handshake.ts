import { type ClientConnection, methods, PROTOCOL_VERSION } from "@agentclientprotocol/sdk";
import { modeToSwitchTo } from "./modes.ts";
import type { StartAgentOptions } from "./types.ts";

/** Which ACP session the agent works in, and whether it is the one the relay asked to continue. */
export interface Opened {
  sessionId: string;
  /** True when the agent loaded the earlier session by its id. */
  restored: boolean;
  /** Why an earlier session was asked for and not loaded; undefined when it was loaded or none was asked for. */
  notRestoredBecause: string | undefined;
}

/** While the agent replays a loaded session's history, its updates are not new: they are not logged. */
export interface Replay {
  active: boolean;
}

/** Puts the agent in the mode that makes it ask; failing is loud, since it would otherwise never ask. */
async function switchMode(
  connection: ClientConnection,
  change: { sessionId: string; modeId: string },
): Promise<void> {
  await connection.agent.request(methods.agent.session.setMode, change).catch((error: unknown) => {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `the agent would not switch to its "${change.modeId}" mode, so it could not be made to ask before it acts; the user's own Claude settings may forbid changing the mode (${reason})`,
    );
  });
}

type Modes = Parameters<typeof modeToSwitchTo>[1];

async function newSession(
  connection: ClientConnection,
  options: StartAgentOptions,
): Promise<{ sessionId: string; modes?: Modes }> {
  return connection.agent.request(methods.agent.session.new, {
    cwd: options.cwd,
    mcpServers: [],
    ...(options.sessionMeta ? { _meta: options.sessionMeta } : {}),
  });
}

/** Loads the earlier session: the agent replays its history as updates, which `replay` hides. */
async function loadSession(
  connection: ClientConnection,
  load: { sessionId: string; cwd: string; replay: Replay },
): Promise<{ modes?: Modes }> {
  const { sessionId, cwd, replay } = load;
  replay.active = true;
  try {
    return await connection.agent.request(methods.agent.session.load, {
      sessionId,
      cwd,
      mcpServers: [],
    });
  } finally {
    replay.active = false;
  }
}

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** Loads the session asked for, or says why a new one was made instead. */
async function openSession(
  connection: ClientConnection,
  call: { options: StartAgentOptions; canLoad: boolean; replay: Replay },
): Promise<Opened & { modes?: Modes }> {
  const { options, canLoad, replay } = call;
  const wanted = options.resume?.agentSessionId;
  if (wanted === undefined)
    return {
      ...(await newSession(connection, options)),
      restored: false,
      notRestoredBecause: undefined,
    };
  if (!canLoad)
    return notRestored(connection, options, "this agent cannot load an earlier session");
  const load = { sessionId: wanted, cwd: options.cwd, replay };
  try {
    const loaded = await loadSession(connection, load);
    return { sessionId: wanted, restored: true, notRestoredBecause: undefined, ...loaded };
  } catch (error) {
    return notRestored(connection, options, `the agent could not load it (${reasonOf(error)})`);
  }
}

async function notRestored(connection: ClientConnection, options: StartAgentOptions, why: string) {
  const fresh = await newSession(connection, options);
  return { ...fresh, restored: false, notRestoredBecause: why };
}

/** initialize, then session/new (or session/load when resuming), then the mode that makes it ask. */
export async function handshake(
  connection: ClientConnection,
  call: { options: StartAgentOptions; replay: Replay },
): Promise<Opened> {
  const init = await connection.agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
  });
  const canLoad = init.agentCapabilities?.loadSession === true;
  const { modes, ...opened } = await openSession(connection, { ...call, canLoad });
  const modeId = modeToSwitchTo(call.options.kind, modes);
  if (modeId !== undefined) await switchMode(connection, { sessionId: opened.sessionId, modeId });
  return opened;
}
