/** The relay that answers in the folder is the new one: its pid file names it. */
export function expectPidFileToName(call: { pidFile: string; pid: number; who: string }): void {
  if (call.pidFile === String(call.pid)) return;
  throw new Error(
    `expected the relay's pid file to name ${call.who} (process ${String(call.pid)}), but it says "${call.pidFile}"`,
  );
}
