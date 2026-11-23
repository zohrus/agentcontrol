// Small helpers shared by the smoke steps.
import type { SmokeApp } from "./app-process.ts";

export interface Step {
  name: string;
  run: (app: SmokeApp) => Promise<void>;
}

/** Throws with `message` unless `condition` holds. */
export function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

/** Fetches a page of the app the way a browser does: no secret, nothing but the address. */
export async function pageAt(
  app: SmokeApp,
  path: string,
): Promise<{ status: number; type: string; body: string }> {
  const answer = await fetch(`${app.baseUrl}${path}`);
  const type = answer.headers.get("content-type") ?? "";
  return { status: answer.status, type, body: await answer.text() };
}

/** Writes what the mock agent will do: one list of steps for each prompt it is given. */
export async function writeScript(app: SmokeApp, turns: unknown[][]): Promise<void> {
  await Bun.write(app.scriptPath, JSON.stringify({ turns }));
}
