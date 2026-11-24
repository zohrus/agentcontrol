/** What a machine is, as far as choosing and starting a relay for it goes. */
export interface HostInfo {
  /** Lowercase operating system name: "linux" or "darwin". */
  os: string;
  /** CPU architecture in the names relay binaries use: "x64" or "arm64". */
  arch: string;
  /** Free disk space in the home folder, in GB, when it could be read. */
  freeDiskGb: number | undefined;
  /** The output of `git --version`, or undefined when git is not installed. */
  git: string | undefined;
}

/** A TCP port of the target made reachable on 127.0.0.1 of this machine. */
export interface ForwardedPort {
  localPort: number;
  /** Stops forwarding. */
  close(): Promise<void>;
}

/**
 * One machine the app can run a relay on. Two kinds exist, `local` and `ssh`; there is no plugin
 * mechanism. A later `relay/terminal.*` stream rides the same `bridgeCommand()` channel (see
 * docs/decisions/2026-11-22-remote-workspaces.md).
 */
export interface WorkspaceTarget {
  readonly kind: "local" | "ssh";
  /**
   * The argv that runs the relay bridge on the target, with its `--stdio` and `--data-dir` flags.
   * With `path` the relay (and the agents it starts) run with that PATH.
   */
  bridgeCommand(options?: { path?: string | undefined }): string[];
  /**
   * The PATH the user's login shell has on the target, so agents installed by the user (npm, nvm,
   * ~/.local/bin) are found although a non-interactive ssh session has a minimal one. Undefined when
   * it cannot be read, or when the app's own PATH is the right one (local).
   */
  loginPath(): Promise<string | undefined>;
  /** OS, CPU architecture, free disk and git of the target. Rejects with the reason it is unreachable. */
  inspect(): Promise<HostInfo>;
  /**
   * Copies the relay binary at `binaryPath` (this app's build, for the target's OS and CPU) to its
   * versioned place on the target. Does nothing when an identical file is already there, so a
   * binary left by an earlier build of the same version is replaced.
   */
  install(binaryPath: string): Promise<{ installed: boolean }>;
  /** Makes a TCP port of the target reachable on 127.0.0.1 here (ssh -L); local returns the same port. */
  forwardPort(remotePort: number): Promise<ForwardedPort>;
  /** Stops the relay daemon on the target, and with it the agents it runs. */
  stopRelay(): Promise<void>;
  /** Turns what a failed bridge printed on stderr into a plain-language reason, if it can. */
  explainFailure(stderr: string): string | undefined;
}
