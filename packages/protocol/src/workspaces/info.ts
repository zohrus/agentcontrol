import { z } from "zod";

/**
 * Whether the app can use a workspace right now:
 * - `connecting`: the first connection attempt is running.
 * - `connected`: the relay answers; sessions can be started and controlled.
 * - `reconnecting`: the connection dropped (network, laptop sleep); the app is trying again. The
 *   sessions keep running on the machine.
 * - `offline`: the last attempt failed; `reason` says why in plain words. The app keeps trying.
 * - `needs-relay-update`: the relay answers but is another version than the app, or the same version
 *   built from other code (see `buildIdentity`), and has sessions still working. It is used as it
 *   is; `workspaces.restartRelay` replaces it (its agents end). An idle relay of another version or
 *   build is replaced at connect, without a stop here.
 * - `removed`: the user removed the workspace; its past sessions stay readable.
 */
export const ConnectionState = z.enum([
  "connecting",
  "connected",
  "reconnecting",
  "offline",
  "needs-relay-update",
  "removed",
]);
export type ConnectionState = z.infer<typeof ConnectionState>;

/** A workspace's connection state and, when it is not good, why. */
export const ConnectionStatus = z.object({
  state: ConnectionState,
  reason: z.string().optional(),
  /** The version the workspace's relay reported, while one is connected. */
  relayVersion: z.string().optional(),
});
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

/** A machine the app runs agents on, with its connection state. */
export const WorkspaceInfo = ConnectionStatus.extend({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["local", "ssh"]),
  /** The ssh host (an alias from ~/.ssh/config, or user@host) of an `ssh` workspace. */
  sshHost: z.string().optional(),
  /** This release's version, which the workspace's relay has to be too. */
  appVersion: z.string(),
  /** When the app last had a working connection, as an ISO time. */
  lastSeenAt: z.string().optional(),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfo>;
