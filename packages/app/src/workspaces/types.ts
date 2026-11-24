import type { CheckStep, WorkspaceInfo } from "@agentcontrol/protocol";
import type { Link } from "../sync/index.ts";

/** The relay binary built for a machine's OS and CPU, with what to do when that file is missing. */
interface RelayBinaryFor {
  (machine: { os: string; arch: string }): string;
  /** Said after "no relay" when the file does not exist, e.g. how to build it. */
  missingAdvice?: (machine: { os: string; arch: string }) => string;
  /**
   * Says why the file that exists is not built from this app's code, e.g. how to build it again;
   * undefined when it is. Only a source checkout can have such a file: a release ships its own.
   */
  staleAdvice?: (machine: { os: string; arch: string }) => Promise<string | undefined>;
}

/** How the app reaches ssh workspaces. */
export interface SshSettings {
  /** A config file for `ssh -F`; the usual ~/.ssh/config when left out. */
  configFile?: string;
  /** The relay binary built for a machine's OS and CPU (`linux`/`darwin`, `x64`/`arm64`). */
  relayBinaryFor: RelayBinaryFor;
  /** Where on a host AgentControl keeps its files. Default `~/.agentcontrol`. */
  remoteRoot?: string;
  /** The longest pause between connection attempts to a host, in ms (15000 by default). */
  backoffMaxMs?: number;
}

/** The machines the app runs agents on: each has one relay connection that is kept up. */
export interface Workspaces {
  /** The id of the workspace for this machine; it always exists and cannot be removed. */
  readonly localId: string;
  /** The local workspace's link, for what the app itself runs there (the Modify agent). */
  readonly localLink: Link;
  /** Every workspace, removed ones included, local first. */
  list(): WorkspaceInfo[];
  /** One workspace with its current connection state. */
  info(id: string): WorkspaceInfo | undefined;
  /** The relay link of a workspace, only while it is connected. */
  link(id: string): Link | undefined;
  /**
   * Adds an ssh workspace and connects to it, installing the relay on the host when needed.
   * Resolves once the first attempt has settled: the workspace is `connected`, or `offline` with a reason.
   */
  addSsh(options: {
    host: string;
    label?: string | undefined;
    /** Names this request on the live stream's `workspace-progress` messages, one per setup step. */
    requestId?: string | undefined;
  }): Promise<WorkspaceInfo>;
  /** Disconnects and marks the workspace removed. Its past sessions stay readable; the host is not touched. */
  remove(id: string): Promise<WorkspaceInfo>;
  /** The "Check and repair" checklist: connect, inspect, install the relay, agents, repositories. */
  check(id: string, options?: { requestId?: string | undefined }): Promise<CheckStep[]>;
  /** Stops the relay on the machine (its sessions end) and reconnects, which starts the app's own. */
  restartRelay(id: string): Promise<WorkspaceInfo>;
  /** Host aliases from the user's ssh config, without patterns. */
  hosts(): Promise<string[]>;
  /** Stops every connection; relays keep running on their machines. */
  stop(): Promise<void>;
}
