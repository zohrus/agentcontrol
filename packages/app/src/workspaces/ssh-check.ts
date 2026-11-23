import type { CheckStep, ConnectionStatus } from "@agentcontrol/protocol";
import type { HostInfo, WorkspaceTarget } from "../relays/index.ts";
import { checkThroughRelay, step } from "./check.ts";
import { type Reporter, reported } from "./progress.ts";
import type { Entry } from "./registry.ts";
import { installOn } from "./ssh-connect.ts";
import type { SshSettings } from "./types.ts";

const CONNECT_WAIT_MS = 20_000;

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const LABELS = {
  connect: "Connect to the host",
  platform: "Operating system and CPU",
  install: "Relay installed",
  relay: "Relay running",
} as const;

const BEGINNINGS = {
  connect: "Reaching the host over ssh.",
  platform: "Looking at the operating system and CPU.",
  install: "Putting the relay on the host.",
  relay: "Starting the relay and connecting to it.",
} as const;

type StepId = keyof typeof LABELS;

const begin = (id: StepId) => ({ id, label: LABELS[id], message: BEGINNINGS[id] });

const skipped = (...ids: StepId[]): CheckStep[] =>
  ids.map((id) => step(id, LABELS[id], { status: "skipped", detail: "An earlier step failed." }));

/** The relay's connection once it has had a chance to come up, asking for another try if it was down. */
async function connectionOf(entry: Entry) {
  const { sync, waiter } = entry;
  const { state } = sync.status();
  if (state === "connected" || state === "needs-relay-update") return sync.status();
  sync.retryNow();
  return (await waiter.next(CONNECT_WAIT_MS)) ?? sync.status();
}

/** What the host is; whether a relay exists for it is the install step's finding. */
function platformStep(machine: HostInfo): CheckStep {
  const detail = `${machine.os} ${machine.arch}`;
  return step("platform", LABELS.platform, { status: "ok", detail });
}

/** Installs (or finds in place) the relay, reporting it as a step. */
async function installStep(options: {
  target: WorkspaceTarget;
  machine: HostInfo;
  relayBinaryFor: SshSettings["relayBinaryFor"];
}): Promise<CheckStep> {
  try {
    const { installed } = await installOn(options);
    const detail = installed ? "Installed." : "Already installed.";
    return step("install", LABELS.install, { status: "ok", detail });
  } catch (error) {
    return step("install", LABELS.install, { status: "failed", detail: reasonOf(error) });
  }
}

/** The "Relay running" step for a connection's state. */
export function relayStepOf(status: ConnectionStatus): CheckStep {
  if (status.state === "connected") {
    return step("relay", LABELS.relay, { status: "ok", detail: "Connected." });
  }
  const detail = status.reason ?? `The workspace is ${status.state}.`;
  return step("relay", LABELS.relay, { status: "failed", detail });
}

/** Reaches the host: its result, and what the host is when it answered. */
async function connectStep(target: WorkspaceTarget) {
  try {
    const machine = await target.inspect();
    return { machine, result: step("connect", LABELS.connect, { status: "ok" }) };
  } catch (error) {
    const detail = reasonOf(error);
    return {
      machine: undefined,
      result: step("connect", LABELS.connect, { status: "failed", detail }),
    };
  }
}

/**
 * Reaching the host, and what the relay needs from it, as steps (each reported as it happens);
 * stops at the first failure.
 */
export async function hostSteps(options: {
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
  report: Reporter;
}): Promise<{ steps: CheckStep[]; ok: boolean }> {
  const { target, relayBinaryFor, report } = options;
  const reached: { machine: HostInfo | undefined } = { machine: undefined };
  const connect = await reported({
    report,
    begin: begin("connect"),
    work: async () => {
      const outcome = await connectStep(target);
      reached.machine = outcome.machine;
      return outcome.result;
    },
  });
  const { machine } = reached;
  if (machine === undefined)
    return { steps: [connect, ...skipped("platform", "install")], ok: false };
  const platform = await reported({
    report,
    begin: begin("platform"),
    work: () => platformStep(machine),
  });
  const work = () => installStep({ target, machine, relayBinaryFor });
  const installed = await reported({ report, begin: begin("install"), work });
  return { steps: [connect, platform, installed], ok: installed.status === "ok" };
}

/**
 * The "Check and repair" checklist of an ssh workspace: reach the host, check its platform, install
 * the relay, make sure it runs, then the relay's own checks. A step after a failed one is skipped.
 */
export async function checkSshWorkspace(options: {
  entry: Entry;
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
  report: Reporter;
}): Promise<CheckStep[]> {
  const { entry, report } = options;
  const host = await hostSteps(options);
  if (!host.ok) return [...host.steps, ...skipped("relay")];
  const running = await reported({
    report,
    begin: begin("relay"),
    work: async () => relayStepOf(await connectionOf(entry)),
  });
  if (running.status !== "ok") return [...host.steps, running];
  return [...host.steps, running, ...(await checkThroughRelay(entry.sync, report))];
}
