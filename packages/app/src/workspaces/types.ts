import type { CheckStep, WorkspaceInfo } from "@agentcontrol/protocol";
import type { Link } from "../sync/index.ts";

/** How the app reaches ssh workspaces. */
export interface SshSettings {
  /** A config file for `ssh -F`; the usual ~/.ssh/config when left out. */
  configFile?: string;
  /** The relay binary built for a machine's OS and CPU (`linux`/`darwin`, `x64`/`arm64`). */
  relayBinaryFor: (machine: { os: string; arch: string }) => string;
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
  addSsh(options: { host: string; label?: string | undefined }): Promise<WorkspaceInfo>;
  /** Disconnects and marks the workspace removed. Its past sessions stay readable; the host is not touched. */
  remove(id: string): Promise<WorkspaceInfo>;
  /** The "Check and repair" checklist: connect, inspect, install the relay, agents, repositories. */
  check(id: string): Promise<CheckStep[]>;
  /** Stops the relay on the host (its sessions end) and reconnects, which starts the app's version. */
  restartRelay(id: string): Promise<WorkspaceInfo>;
  /** Host aliases from the user's ssh config, without patterns. */
  hosts(): Promise<string[]>;
  /** Resolves once the local relay is connected and synced. */
  ready(): Promise<void>;
  /** Stops every connection; relays keep running on their machines. */
  stop(): Promise<void>;
}
