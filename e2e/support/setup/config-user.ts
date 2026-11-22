import {
  ApiError,
  type ApplyResult,
  type Client,
  type ConfigTarget,
  type ConfigPlan,
  type ScopedItem,
} from "@agentcontrol/sdk";

/** A plan the user looked at, and what applying it did. */
interface Applied {
  plan: ConfigPlan;
  result: ApplyResult;
}

async function refusalOf(request: Promise<unknown>): Promise<string | undefined> {
  try {
    await request;
    return undefined;
  } catch (error) {
    if (error instanceof ApiError) return error.code;
    throw error;
  }
}

type Target = { includingTheRepo?: boolean; onlyForClaudeCode?: boolean };

const targetOf = (options: Target, repoPath: string): ConfigTarget => ({
  ...(options.includingTheRepo ? { repoPath } : {}),
  ...(options.onlyForClaudeCode ? { agents: ["claude-code" as const] } : {}),
});

/** Setting up items and looking at what the agents have today. */
function lookingAround({ sdk, repoPath }: { sdk: Client; repoPath: string }) {
  return {
    /** Sets up these items in the app (replacing what was set up before). */
    setsUp: (items: ScopedItem[]): Promise<ScopedItem[]> => sdk.config.save(items),
    /** Reads what the agents already have configured. */
    importsTheExistingSetup: (options: Target = {}): Promise<ScopedItem[]> =>
      sdk.config.import(targetOf(options, repoPath)),
    /** Looks at the items the app holds. */
    looksAtWhatIsSetUp: (): Promise<ScopedItem[]> => sdk.config.list(),
    /** Checks whether the agents' files still match what the app wrote. */
    checksForDrift: () => sdk.config.drift(),
  };
}

/** Reviewing, applying and rolling back. */
function changingFiles({ sdk, repoPath }: { sdk: Client; repoPath: string }) {
  return {
    /** Reviews what applying would change, without writing anything. */
    reviewsThePlan: (options: Target = {}): Promise<ConfigPlan> =>
      sdk.config.plan(targetOf(options, repoPath)),
    /** Applies a plan the user has just reviewed. */
    appliesThePlan: (plan: ConfigPlan): Promise<ApplyResult> => sdk.config.apply(plan.planId),
    /** Reviews the plan this many more times, as a user does while editing. */
    reviewsThePlanAgain: async (times: number): Promise<void> => {
      for (let i = 0; i < times; i++) await sdk.config.plan({});
    },
    /** Reviews the plan and applies it. */
    reviewsAndAppliesThePlan: async (options: Target = {}): Promise<Applied> => {
      const plan = await sdk.config.plan(targetOf(options, repoPath));
      return { plan, result: await sdk.config.apply(plan.planId) };
    },
    /** Rolls back the apply that returned this backup. */
    rollsBack: (applied: Applied): Promise<string[]> =>
      sdk.config.rollback(applied.result.backupId),
  };
}

/** Asking for things the app is expected to refuse; each says why it refused, or nothing if it did not. */
function askingForTheWrongThing({ sdk }: { sdk: Client }) {
  return {
    /** Tries to apply a plan; says why the app refused, or nothing if it applied. */
    triesToApplyThePlan: (plan: ConfigPlan): Promise<string | undefined> =>
      refusalOf(sdk.config.apply(plan.planId)),
    /** Tries to review the plan; says why the app refused, or nothing if it made one. */
    triesToReviewThePlan: (): Promise<string | undefined> => refusalOf(sdk.config.plan({})),
    /** Tries to roll back to a backup that may not exist; says why the app refused. */
    triesToRollBackTo: (backupId: string): Promise<string | undefined> =>
      refusalOf(sdk.config.rollback(backupId)),
    /** Tries to set up these items; says why the app refused, or nothing if it saved them. */
    triesToSetUp: (items: ScopedItem[]): Promise<string | undefined> =>
      refusalOf(sdk.config.save(items)),
  };
}

/** What a person does in the harness-config screens, each step through the SDK. */
export function configUserOf(app: { sdk: Client; repoPath: string }) {
  return { ...lookingAround(app), ...changingFiles(app), ...askingForTheWrongThing(app) };
}

export type ConfigUser = ReturnType<typeof configUserOf>;
