import { INSPECT_SCRIPT, parseHostInfo } from "./host-info.ts";
import { forwardOverSsh } from "./ssh-forward.ts";
import { explainSsh } from "./ssh-failure.ts";
import { installRelayBinary } from "./ssh-install.ts";
import { remoteWord, shellQuote } from "./ssh-quote.ts";
import { runSsh, runSshOrFail, type SshDestination, sshArgv } from "./ssh-run.ts";
import type { WorkspaceTarget } from "./target.ts";

export interface SshTargetOptions extends SshDestination {
  /** The version of the relay this app runs; its binary is kept in a folder of that name. */
  version: string;
  /** Where on the host AgentControl keeps its files. Default `~/.agentcontrol`. */
  root?: string;
}

const BINARY_NAME = "agentcontrol-relay";

/** Where the relay binary of `version` lives on the host, relative to `root`. */
const binaryPathIn = (root: string, version: string): string =>
  `${root}/relay/${version}/${BINARY_NAME}`;

/** `env PATH=...` in front of the relay, when a PATH is to be set. */
const withPath = (path: string | undefined): string[] =>
  path === undefined ? [] : ["env", shellQuote(`PATH=${path}`)];

const LOGIN_PATH_SCRIPT = `"\${SHELL:-/bin/sh}" -lc 'printf "AGENTCONTROL_PATH=%s" "$PATH"'`;

/** The PATH of the user's login shell on the host; a profile's chatter before it is ignored. */
async function readLoginPath(destination: SshDestination): Promise<string | undefined> {
  const result = await runSsh({ destination, script: LOGIN_PATH_SCRIPT });
  const found = /AGENTCONTROL_PATH=([^\n]*)$/.exec(result.stdout);
  return found?.[1] === "" ? undefined : found?.[1];
}

/** A workspace on another machine, reached with the system `ssh` (config, keys and agent as usual). */
export function sshTarget(options: SshTargetOptions): WorkspaceTarget {
  const { host, configFile, version, root = "~/.agentcontrol" } = options;
  const destination: SshDestination = { host, configFile };
  const binary = binaryPathIn(root, version);
  const dataDir = `${root}/relay-data`;
  const relayArgv = (...rest: string[]): string[] => [remoteWord(binary), ...rest];
  const inDataDir = ["--data-dir", remoteWord(dataDir)];
  return {
    kind: "ssh",
    bridgeCommand: (settings) => [
      ...sshArgv(destination),
      ...withPath(settings?.path),
      ...relayArgv("--stdio", ...inDataDir),
    ],
    loginPath: () => readLoginPath(destination),
    inspect: async () => parseHostInfo(await runSshOrFail({ destination, script: INSPECT_SCRIPT })),
    isInstalled: async () => {
      const result = await runSsh({ destination, script: `test -x ${remoteWord(binary)}` });
      return result.exitCode === 0;
    },
    install: (localBinary) =>
      installRelayBinary({ destination, localPath: localBinary, remotePath: binary }),
    forwardPort: (remotePort) => forwardOverSsh({ destination, remotePort }),
    stopRelay: async () => {
      const script = [...relayArgv("stop", ...inDataDir)].join(" ");
      await runSshOrFail({ destination, script });
    },
    explainFailure: (stderr) => explainSsh({ stderr, host }),
  };
}
