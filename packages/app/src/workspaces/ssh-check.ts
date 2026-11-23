import type { CheckStep } from "@agentcontrol/protocol";
import type { HostInfo, WorkspaceTarget } from "../relays/index.ts";
import { checkThroughRelay, step } from "./check.ts";
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

const skipped = (...ids: Array<keyof typeof LABELS>): CheckStep[] =>
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

async function relayStep(entry: Entry): Promise<CheckStep> {
  const { state, reason } = await connectionOf(entry);
  if (state === "connected")
    return step("relay", LABELS.relay, { status: "ok", detail: "Connected." });
  const detail = reason ?? `The workspace is ${state}.`;
  return step("relay", LABELS.relay, { status: "failed", detail });
}

/** Reaching the host, and what the relay needs from it, as steps; stops at the first failure. */
async function hostSteps(options: {
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
}): Promise<{ steps: CheckStep[]; ok: boolean }> {
  const { target, relayBinaryFor } = options;
  let machine: HostInfo;
  try {
    machine = await target.inspect();
  } catch (error) {
    const failed = step("connect", LABELS.connect, { status: "failed", detail: reasonOf(error) });
    return { steps: [failed, ...skipped("platform", "install")], ok: false };
  }
  const installed = await installStep({ target, machine, relayBinaryFor });
  const steps = [
    step("connect", LABELS.connect, { status: "ok" }),
    platformStep(machine),
    installed,
  ];
  return { steps, ok: steps.every((each) => each.status === "ok") };
}

/**
 * The "Check and repair" checklist of an ssh workspace: reach the host, check its platform, install
 * the relay, make sure it runs, then the relay's own checks. A step after a failed one is skipped.
 */
export async function checkSshWorkspace(options: {
  entry: Entry;
  target: WorkspaceTarget;
  relayBinaryFor: SshSettings["relayBinaryFor"];
}): Promise<CheckStep[]> {
  const host = await hostSteps(options);
  if (!host.ok) return [...host.steps, ...skipped("relay")];
  const running = await relayStep(options.entry);
  if (running.status !== "ok") return [...host.steps, running];
  return [...host.steps, running, ...(await checkThroughRelay(options.entry.sync))];
}
