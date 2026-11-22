import type {
  ApplyResult,
  ConfigAgent,
  ConfigPlan,
  DriftReport,
  ScopedItem,
} from "@agentcontrol/protocol";
import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";

/** Which agents to look at or write for, and the repo whose own files are included. */
export interface ConfigTarget {
  /** Defaults to every agent that has configuration: "claude-code" and "codex". */
  agents?: ConfigAgent[];
  /** Absolute path of a repo; its own config files are read or written too. */
  repoPath?: string;
}

/** The canonical items the app holds, and the existing setup the agents already have. */
function configItemsApi(api: Api) {
  return {
    /** The canonical items the app holds: MCP servers, instructions, skills, hooks, commands, permissions, env. */
    list: async (): Promise<ScopedItem[]> => {
      const { items } = await read(api.config.items.$get());
      return items;
    },
    /** Replaces every canonical item with the given ones and returns what is now stored. */
    save: async (items: ScopedItem[]): Promise<ScopedItem[]> => {
      const saved = await read(api.config.items.$put({ json: { items } }));
      return saved.items;
    },
    /** Reads what the agents already have configured (hand-written setup included) as items. Stores nothing. */
    import: async (target: ConfigTarget = {}): Promise<ScopedItem[]> => {
      const { items } = await read(api.config.import.$post({ json: target }));
      return items;
    },
  };
}

/** Putting the items into the agents' files: plan, apply, roll back, and check for drift. */
function configFilesApi(api: Api) {
  return {
    /** Shows every file change applying the stored items would make, and what cannot be written, without writing. */
    plan: (target: ConfigTarget = {}): Promise<ConfigPlan> =>
      read(api.config.plan.$post({ json: target })),
    /** Writes a plan to disk after backing the files up. Throws ApiError "config-plan-stale" if files moved since the plan. */
    apply: (planId: string): Promise<ApplyResult> =>
      read(api.config.apply.$post({ json: { planId } })),
    /** Puts every file of an earlier apply back byte for byte, and removes the ones it created. */
    rollback: async (backupId: string): Promise<string[]> => {
      const { restored } = await read(api.config.rollback.$post({ json: { backupId } }));
      return restored;
    },
    /** Compares every managed entry on disk with what the app last wrote: in-sync, drift or missing. */
    drift: (): Promise<DriftReport> => read(api.config.drift.$get()),
  };
}

/** Harness configuration: set it up once here, write it into every agent's own files. */
export function configApi(api: Api) {
  return { ...configItemsApi(api), ...configFilesApi(api) };
}
