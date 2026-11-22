/** A failure of an ssh command, with a reason a user can act on. */
export class SshFailure extends Error {}

const REASONS: Array<[RegExp, (host: string) => string]> = [
  [
    /Could not resolve hostname/i,
    () => "The host name was not found. Check the name and your network.",
  ],
  [
    /Connection refused/i,
    () => "The machine refused the connection: ssh is not running there, or on another port.",
  ],
  [
    /timed out|No route to host|Network is unreachable/i,
    () => "The machine did not answer. Check that it is on and reachable from here.",
  ],
  [
    /Host key verification failed|REMOTE HOST IDENTIFICATION HAS CHANGED/i,
    (host) =>
      `The host key is not trusted yet, or has changed. Run \`ssh ${host}\` in a terminal once to check it.`,
  ],
  [
    /Permission denied/i,
    (host) =>
      `ssh could not sign in. Make sure \`ssh ${host}\` works in a terminal without a password prompt.`,
  ],
];

/** What went wrong, from the text ssh printed, in plain words; undefined when it printed nothing. */
export function explainSsh(options: { stderr: string; host: string }): string | undefined {
  const { stderr, host } = options;
  const known = REASONS.find(([pattern]) => pattern.test(stderr));
  if (known) return known[1](host);
  const last = stderr.split("\n").findLast((line) => line.trim() !== "");
  return last?.trim();
}
