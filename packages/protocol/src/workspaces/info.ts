import { z } from "zod";

/**
 * Whether the app can use a workspace right now:
 * - `connecting`: the first connection attempt is running.
 * - `connected`: the relay answers; sessions can be started and controlled.
 * - `reconnecting`: the connection dropped (network, laptop sleep); the app is trying again. The
 *   sessions keep running on the machine.
 * - `offline`: the last attempt failed; `reason` says why in plain words. The app keeps trying.
 * - `needs-relay-update`: the machine runs a relay of another version with sessions still working;
 *   it is replaced when they end, or at once with `workspaces.restartRelay`.
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
});
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;

/** A machine the app runs agents on, with its connection state. */
export const WorkspaceInfo = ConnectionStatus.extend({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["local", "ssh"]),
  /** The ssh host (an alias from ~/.ssh/config, or user@host) of an `ssh` workspace. */
  sshHost: z.string().optional(),
  /** When the app last had a working connection, as an ISO time. */
  lastSeenAt: z.string().optional(),
});
export type WorkspaceInfo = z.infer<typeof WorkspaceInfo>;
