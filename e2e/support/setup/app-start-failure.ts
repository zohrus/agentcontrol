import { startAppWithLocalWorkspace } from "./start-app.ts";

/** What came of starting the app: it is running, or it refused to start and said why. */
export type StartOutcome =
  | { readonly started: true }
  | { readonly started: false; readonly reason: string };

/** Starts the app with a default UI that is not where it should be, and reports what happened. */
export async function triesToStartTheAppWithoutItsDefaultUi(): Promise<StartOutcome> {
  const modify = { agent: "mock" as const, templateDir: "/nonexistent/ui", templateVersion: "0" };
  try {
    await startAppWithLocalWorkspace({ modify });
    return { started: true };
  } catch (error) {
    return { started: false, reason: error instanceof Error ? error.message : String(error) };
  }
}
