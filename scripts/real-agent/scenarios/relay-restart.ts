import type { SessionEvent, SessionId } from "../../../packages/sdk/src/index.ts";
import { probeSessionLoad } from "../resume-probe.ts";
import type { Run } from "../scenario.ts";
import { flowSessionOf, messageOf } from "../steps.ts";

interface Sent {
  method?: string;
  params?: { sessionId?: string };
}

/** The adapter's own id of the session, as it appears in the prompt the relay sent. */
function agentSessionIdOf(events: SessionEvent[]): string {
  const prompts = events.flatMap((event) =>
    event.kind === "acp" ? [event.payload.message as Sent] : [],
  );
  const id = prompts.find((message) => message.method === "session/prompt")?.params?.sessionId;
  if (id === undefined) throw new Error("expected the log to hold the agent's session id");
  return id;
}

function worktreeOf(events: SessionEvent[]): string {
  const created = events.find((event) => event.kind === "session-created");
  if (created?.kind !== "session-created") throw new Error("expected the log to start a session");
  return created.payload.worktreePath;
}

async function noteNewPrompt(run: Run, id: SessionId): Promise<void> {
  const outcome = await run.world.app.sdk.sessions.sendPrompt(id, "Say ok.").then(
    () => "was accepted",
    (error: unknown) => `failed with: ${messageOf(error)}`,
  );
  run.note(`a new prompt after the relay restart ${outcome}`);
}

async function noteResume(run: Run, events: SessionEvent[]): Promise<void> {
  const cwd = worktreeOf(events);
  const found = await probeSessionLoad({ sessionId: agentSessionIdOf(events), cwd });
  const earlier = `asked about the earlier edit it said "${found.answer.slice(0, 80)}"`;
  run.note(
    `session/load offered ${String(found.offered)}; replayed ${String(found.replayed)} messages; next turn ${found.stopReason}; ${earlier}`,
  );
}

/** (g) The relay daemon restarts: the agent is gone; report the state and whether `session/load` resumes it. */
export async function relayRestart(run: Run): Promise<void> {
  const id = flowSessionOf(run);
  const events = await run.world.eventsOf(id);
  await run.world.app.theRelayStops();
  await run.world.app.theRelayStartsAgain();
  const row = await run.world.waitsForSession({
    id,
    describe: "the session to read as idle once the app has reconnected",
    when: (candidate) => candidate.status !== "waiting",
  });
  run.note(`after the restart: status ${row.status}, turnRunning ${String(row.turnRunning)}`);
  await noteNewPrompt(run, id);
  await noteResume(run, events);
}
