import { VERSION } from "@agentcontrol/protocol";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SshSettings } from "@agentcontrol/app";
import { onTestEnd } from "./cleanup.ts";
import { createLocalRepo } from "./local-repo.ts";
import { createMockAgent, type MockAgent } from "./mock-agent-script.ts";
import { type SshNetwork, startSshNetwork } from "./ssh-network.ts";
import { type SshHostOptions, writeLoginShellWithAgent } from "./ssh-host-options.ts";
import { writeRelayBinary } from "./ssh-relay-binary.ts";
import { startSshd } from "./ssh-sshd.ts";
import { relayBinaryOf, writeBuiltRelayFolder } from "./ssh-built-relay-folder.ts";

/**
 * Another machine, reached over real ssh: a private sshd on this computer, with its own keys, a
 * home folder of its own, a git repo and a mock agent. Nothing in the user's ~/.ssh is touched.
 */
export interface SshHost {
  /** The host's name in `configFile`, as a user would type it. */
  readonly alias: string;
  /** The generated ssh config the app is told to use (`ssh -F`). */
  readonly configFile: string;
  /** Where AgentControl keeps its files on the host. */
  readonly remoteRoot: string;
  /** The host's home folder: what its relay and its agents see as `$HOME`. */
  readonly home: string;
  /** The mock agent that runs on the host, with its own script. */
  readonly mockAgent: MockAgent;
  /** A git repo on the host. */
  readonly repoPath: string;
  /** The network between the app and the host: cut it to see what the app does. */
  readonly network: SshNetwork;
  /** The host's relay data folder: its socket, pid file and session logs. */
  readonly relayDataDir: string;
  /** Where the relay of the app's version is installed on the host. */
  readonly installedRelay: string;
  /** The file the app installs from: the relay that runs this checkout's code. */
  readonly builtRelay: string;
  /** What to give `startApp` so that it reaches this host and installs the relay from here. */
  readonly appSettings: Pick<SshSettings, "configFile" | "relayBinaryFor"> & {
    backoffMaxMs: number;
  };
  /** The pid of the relay daemon running on the host, if one is. */
  relayPid(): Promise<number | undefined>;
  /** Lets a host agent that waits (`mockAgent.willWaitForFile(host.releaseFile)`) go on. */
  agentContinues(): Promise<void>;
  /** The file a host agent waits for, to be told to go on. */
  readonly releaseFile: string;
  /** The host's agent will say `first`, wait until it is let go on, then say `second`. */
  agentWillPauseBetween(first: string, second: string): void;
}

async function prepareRemoteSide(folder: string, options: SshHostOptions) {
  const home = join(folder, "remote", "home");
  const remoteRoot = join(home, ".agentcontrol");
  await mkdir(home, { recursive: true });
  await Bun.write(
    join(home, ".gitconfig"),
    "[user]\n\tname = Remote User\n\temail = remote@example.com\n",
  );
  const mockAgent = await createMockAgent();
  const built = join(folder, "build", "agentcontrol-relay");
  const login = options.agentOnLoginPathOnly ? await writeLoginShellWithAgent(folder) : undefined;
  const claudeCommand = login?.claudeCommand;
  const spec = {
    path: built,
    home,
    mockAgentScript: mockAgent.scriptPath,
    codeServer: options.codeServer === true,
  };
  await writeRelayBinary({ ...spec, ...(claudeCommand && { claudeCommand }) });
  return { home, remoteRoot, mockAgent, built, shell: login?.shell };
}

function stopRelayOnHostAtTestEnd(options: { built: string; relayDataDir: string }): void {
  onTestEnd(async () => {
    const stop = Bun.spawn([options.built, "stop", "--data-dir", options.relayDataDir]);
    await stop.exited;
  });
}

const ALIAS = "test-host";

/** The ssh server, the network in front of it, and the config file that reaches it. */
async function startReachableMachine(options: {
  folder: string;
  home: string;
  shell: string | undefined;
}) {
  const { folder } = options;
  const sshd = await startSshd(options);
  onTestEnd(() => sshd.stop());
  const network = startSshNetwork(sshd.port);
  onTestEnd(() => {
    network.stop();
    return Promise.resolve();
  });
  const configFile = join(folder, "ssh_config");
  const block = sshd.hostBlock({ alias: ALIAS, viaPort: network.port });
  await Bun.write(
    join(folder, "config.d", "more"),
    "Host other-host\n  HostName example.invalid\n",
  );
  const text = `Include ${join(folder, "config.d", "*")}\nInclude ${join(folder, "missing.d", "*")}\nInclude ~/.agentcontrol-test-missing/*\n\n${block}\n\nHost *.wildcard.example\n  User nobody\n`;
  await Bun.write(configFile, text);
  return { network, configFile };
}

/** What a test does to make the host's agent pause and go on. */
function hostAgentOf(options: { mockAgent: MockAgent; releaseFile: string }) {
  const { mockAgent, releaseFile } = options;
  return {
    agentWillPauseBetween: (first: string, second: string): void => {
      mockAgent.willReply(first);
      mockAgent.willWaitForFile(releaseFile);
      mockAgent.willReply(second);
    },
    agentContinues: async (): Promise<void> => {
      await Bun.write(releaseFile, "go");
    },
  };
}

/** The pid in the relay's pid file, if it has one. */
async function readRelayPid(relayDataDir: string): Promise<number | undefined> {
  const text = await readFile(join(relayDataDir, "relay.pid"), "utf8").catch(() => "");
  return Number(text) || undefined;
}

interface Parts {
  folder: string;
  machine: { network: SshNetwork; configFile: string };
  side: Awaited<ReturnType<typeof prepareRemoteSide>>;
  options: SshHostOptions;
  /** The `dist/` folder of a source checkout, when the test has one. */
  dist: string | undefined;
}

/** The host as tests use it, from the parts that were started. */
async function hostOf(parts: Parts): Promise<SshHost> {
  const { folder, machine, side, options, dist } = parts;
  const relayDataDir = join(side.remoteRoot, "relay-data");
  const releaseFile = join(folder, "release");
  const { configFile, network } = machine;
  return {
    alias: ALIAS,
    configFile,
    remoteRoot: side.remoteRoot,
    home: side.home,
    mockAgent: side.mockAgent,
    repoPath: await createLocalRepo(),
    network,
    relayDataDir,
    releaseFile,
    ...hostAgentOf({ mockAgent: side.mockAgent, releaseFile }),
    installedRelay: join(side.remoteRoot, "relay", VERSION, "agentcontrol-relay"),
    builtRelay: side.built,
    appSettings: {
      configFile,
      relayBinaryFor: relayBinaryOf(options, { script: side.built, dist }),
      backoffMaxMs: 300,
    },
    relayPid: () => readRelayPid(relayDataDir),
  };
}

/** Starts a host: sshd, a proxy in front of it, a home folder, a repo and a mock agent. */
export async function startSshHost(options: SshHostOptions = {}): Promise<SshHost> {
  const folder = await realpath(await mkdtemp(join(tmpdir(), "agentcontrol-ssh-")));
  onTestEnd(() => rm(folder, { recursive: true, force: true }));
  const side = await prepareRemoteSide(folder, options);
  const machine = await startReachableMachine({ folder, home: side.home, shell: side.shell });
  stopRelayOnHostAtTestEnd({
    built: side.built,
    relayDataDir: join(side.remoteRoot, "relay-data"),
  });
  const { relayBuiltFromSource: builtFrom } = options;
  const dist = builtFrom && (await writeBuiltRelayFolder({ folder, relay: side.built, builtFrom }));
  return hostOf({ folder, machine, side, options, dist: dist || undefined });
}
