import { ErrorCode, RelayName as N } from "@agentcontrol/protocol";
import {
  applyConfig,
  detectDrift,
  inspectConfig,
  planConfig,
  rollbackConfig,
  StalePlanError,
} from "../config/index.ts";
import { RelayError, type Handlers } from "../rpc/index.ts";

type ConfigMethods =
  | typeof N.configInspect
  | typeof N.configPlan
  | typeof N.configApply
  | typeof N.configRollback
  | typeof N.configDrift;

/** A stale or unknown plan is the caller's to redo, so it gets its own error code. */
async function reportStale<T>(work: Promise<T>): Promise<T> {
  return work.catch((error: unknown) => {
    throw error instanceof StalePlanError
      ? new RelayError(ErrorCode.configStale, error.message)
      : error;
  });
}

/** The methods that read and write the agents' native config files under `homeDir`. */
export function configHandlers(homeDir: string): Pick<Handlers, ConfigMethods> {
  return {
    [N.configInspect]: async ({ agents, repoPath }) => ({
      items: await inspectConfig({ agents, homeDir, repoPath }),
    }),
    [N.configPlan]: ({ items, agents, repoPath }) =>
      planConfig({ items, agents, homeDir, repoPath }),
    [N.configApply]: ({ planId }) => reportStale(applyConfig({ planId })),
    [N.configRollback]: async ({ backupId }) => ({
      restored: await rollbackConfig({ backupId, homeDir }),
    }),
    [N.configDrift]: () => detectDrift({ homeDir }),
  };
}
