import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Answer } from "../setup/raw-requests.ts";
import type { FakeInvocation } from "../setup/ide-user.ts";

/** The answer is a refusal with this status, and shows nothing of what is behind it. */
export function expectRefusal(answer: Answer, status: number, secretText?: string): void {
  if (answer.status !== status) {
    throw new Error(
      `expected the request to be refused with ${String(status)}, but the answer was ${String(answer.status)}: ${answer.body.slice(0, 120)}`,
    );
  }
  if (secretText !== undefined && answer.body.includes(secretText)) {
    throw new Error(`expected the refusal not to show "${secretText}", but it did`);
  }
}

/** The app refused with its stable code. */
export function expectAppRefusal(answer: Answer, code: string): void {
  if (answer.code !== code) {
    throw new Error(
      `expected the app to refuse with "${code}", but it answered ${String(answer.status)} ${answer.code ?? ""}: ${answer.body.slice(0, 120)}`,
    );
  }
}

/** The page the IDE serves holds none of the app's secrets (its token, its token tag). */
export function expectNoAppSecretIn(page: string, token: string): void {
  if (page.includes(token) || page.includes("agentcontrol-token")) {
    throw new Error("expected the IDE's page to hold none of the app's secret, but it did");
  }
}

async function modeOf(path: string): Promise<number> {
  return (await stat(path)).mode & 0o777;
}

/** The flags that matter: a unix socket with mode 600, no password-less TCP port. */
function expectPrivateFlags(one: FakeInvocation): void {
  const flags = one.argv.join(" ");
  const wanted = ["--socket ", "--socket-mode 600", "--auth none"];
  const forbidden = ["--bind-addr", "--port", "--host", "--cert"];
  const missing = wanted.filter((flag) => !flags.includes(flag));
  const present = forbidden.filter((flag) => one.argv.includes(flag));
  if (missing.length + present.length > 0) {
    throw new Error(
      `expected code-server to listen on a private socket only, but its flags were "${flags}" (missing ${missing.join(", ") || "nothing"}; unwanted ${present.join(", ") || "nothing"})`,
    );
  }
}

/**
 * Nothing but the relay's user can reach code-server: it has no TCP port, its socket is mode 600
 * and sits in a folder (inside the relay's own folder) that is mode 700.
 */
export async function expectCodeServerOnlyOnAPrivateSocket(
  relayDataDir: string,
  one: FakeInvocation,
): Promise<void> {
  expectPrivateFlags(one);
  const run = join(relayDataDir, "ide", "run");
  const [socketName] = await readdir(run);
  const modes = {
    "the ide folder": await modeOf(join(relayDataDir, "ide")),
    "the socket folder": await modeOf(run),
    "the socket": await modeOf(join(run, socketName ?? "missing")),
  };
  const wanted = { "the ide folder": 0o700, "the socket folder": 0o700, "the socket": 0o600 };
  for (const [what, mode] of Object.entries(modes)) {
    if (mode !== wanted[what as keyof typeof wanted]) {
      throw new Error(`expected ${what} to be private, but its mode is ${mode.toString(8)}`);
    }
  }
}
