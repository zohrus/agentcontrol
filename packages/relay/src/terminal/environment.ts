/** The relay's environment, as the daemon holds it (the process environment plus injected values). */
export type HostEnvironment = Record<string, string | undefined>;

/** Variables the relay sets for its own sake; a user's shell must never inherit them. */
const INTERNAL = new Set(["BUN_BE_BUN", "BUN_INSTALL_CACHE_DIR"]);
const INTERNAL_PREFIX = "AGENTCONTROL_";

function isInternal(name: string): boolean {
  return INTERNAL.has(name) || name.startsWith(INTERNAL_PREFIX);
}

/**
 * The environment of a terminal: what the relay runs with, minus the relay's own variables, plus
 * the session's (its ports) and a terminal type that xterm.js understands.
 */
export function shellEnvironment(options: {
  host: HostEnvironment;
  session: Record<string, string>;
}): Record<string, string> {
  const inherited = Object.entries(options.host).filter(
    (entry): entry is [string, string] => entry[1] !== undefined && !isInternal(entry[0]),
  );
  return { ...Object.fromEntries(inherited), ...options.session, TERM: "xterm-256color" };
}

/** The user's login shell as the relay's environment names it; `/bin/sh` when it names none. */
export function loginShell(host: HostEnvironment): string[] {
  const shell = host["SHELL"];
  return [shell === undefined || shell === "" ? "/bin/sh" : shell, "-l"];
}
