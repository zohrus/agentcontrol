import type { ApiOutcome } from "../setup/app-attempt.ts";

/** The app refused the request with this HTTP status and stable error code. */
export function expectAppToRefuse(
  outcome: ApiOutcome<unknown>,
  wanted: { status: number; code: string },
): void {
  if (outcome.ok) {
    throw new Error(`expected the app to refuse with "${wanted.code}", but it accepted`);
  }
  if (outcome.status !== wanted.status || outcome.code !== wanted.code) {
    throw new Error(
      `expected the app to answer ${String(wanted.status)} "${wanted.code}", but it answered ${String(outcome.status)} "${outcome.code}"`,
    );
  }
}

/** The refusal names exactly these uncommitted files. */
export function expectRefusalToListFiles(outcome: ApiOutcome<unknown>, files: string[]): void {
  const data = outcome.ok
    ? undefined
    : (outcome.data as { uncommittedFiles?: string[] } | undefined);
  if (JSON.stringify(data?.uncommittedFiles) !== JSON.stringify(files)) {
    throw new Error(
      `expected the refusal to list ${files.join(", ")}, but it lists ${String(data?.uncommittedFiles)}`,
    );
  }
}
