/** The rollback restored nothing and named this file as changed since the apply. */
export function expectRollbackToWarnAbout(
  outcome: { restored: string[]; changedSince: string[] },
  file: string,
): void {
  const named = outcome.changedSince.some((path) => path.endsWith(file));
  if (!named || outcome.restored.length > 0) {
    throw new Error(
      `expected the rollback to restore nothing and warn about ${file}, but it restored ${String(outcome.restored.length)} files and warned about ${JSON.stringify(outcome.changedSince)}`,
    );
  }
}
