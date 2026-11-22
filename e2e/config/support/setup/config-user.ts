import {
  ApiError,
  type ApplyResult,
  type Client,
  type ConfigPlan,
  type ScopedItem,
} from "@agentcontrol/sdk";

/** A plan the user looked at, and what applying it did. */
interface Applied {
  plan: ConfigPlan;
  result: ApplyResult;
}

type Target = { includingTheRepo?: boolean };

/** Setting up items and looking at what the agents have today. */
function lookingAround({ sdk, repoPath }: { sdk: Client; repoPath: string }) {
  return {
    /** Sets up these items in the app (replacing what was set up before). */
    setsUp: (items: ScopedItem[]): Promise<ScopedItem[]> => sdk.config.save(items),
    /** Reads what the agents already have configured. */
    importsTheExistingSetup: (options: Target = {}): Promise<ScopedItem[]> =>
      sdk.config.import(options.includingTheRepo ? { repoPath } : {}),
    /** Checks whether the agents' files still match what the app wrote. */
    checksForDrift: () => sdk.config.drift(),
  };
}

/** Reviewing, applying and rolling back. */
function changingFiles({ sdk, repoPath }: { sdk: Client; repoPath: string }) {
  return {
    /** Reviews what applying would change, without writing anything. */
    reviewsThePlan: (options: Target = {}): Promise<ConfigPlan> =>
      sdk.config.plan(options.includingTheRepo ? { repoPath } : {}),
    /** Applies a plan the user has just reviewed. */
    appliesThePlan: (plan: ConfigPlan): Promise<ApplyResult> => sdk.config.apply(plan.planId),
    /** Tries to apply a plan; says why the app refused, or nothing if it applied. */
    triesToApplyThePlan: async (plan: ConfigPlan): Promise<string | undefined> => {
      try {
        await sdk.config.apply(plan.planId);
        return undefined;
      } catch (error) {
        if (error instanceof ApiError) return error.code;
        throw error;
      }
    },
    /** Reviews the plan and applies it. */
    reviewsAndAppliesThePlan: async (options: Target = {}): Promise<Applied> => {
      const plan = await sdk.config.plan(options.includingTheRepo ? { repoPath } : {});
      return { plan, result: await sdk.config.apply(plan.planId) };
    },
    /** Rolls back the apply that returned this backup. */
    rollsBack: (applied: Applied): Promise<string[]> =>
      sdk.config.rollback(applied.result.backupId),
  };
}

/** What a person does in the harness-config screens, each step through the SDK. */
export function configUserOf(app: { sdk: Client; repoPath: string }) {
  return { ...lookingAround(app), ...changingFiles(app) };
}

export type ConfigUser = ReturnType<typeof configUserOf>;
