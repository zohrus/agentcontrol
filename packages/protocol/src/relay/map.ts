import type { z } from "zod";
import * as f from "../files/index.ts";
import * as s from "../sessions/index.ts";
import * as w from "../workspace/index.ts";
import { UsageParams, UsageResult } from "../usage/index.ts";
import { DiffParams, DiffResult } from "../worktrees/index.ts";
import { RelayName as N } from "./names.ts";

/** Every request method the app may call on the relay, with its params and result schemas. */
export const RelayMethods = {
  [N.hello]: { params: w.HelloParams, result: w.HelloResult },
  [N.sessionsList]: { params: s.SessionsListParams, result: s.SessionsListResult },
  [N.sessionsCreate]: { params: s.SessionsCreateParams, result: s.SessionsCreateResult },
  [N.eventsSubscribe]: { params: s.EventsSubscribeParams, result: s.EventsSubscribeResult },
  [N.prompt]: { params: s.PromptParams, result: s.AckResult },
  [N.permissionRespond]: { params: s.PermissionRespondParams, result: s.AckResult },
  [N.cancel]: { params: s.CancelParams, result: s.AckResult },
  [N.diff]: { params: DiffParams, result: DiffResult },
  [N.sessionsArchive]: { params: s.SessionsArchiveParams, result: s.SessionsArchiveResult },
  [N.workspaceCheck]: { params: w.WorkspaceCheckParams, result: w.WorkspaceCheckResult },
  [N.reposAdd]: { params: w.ReposAddParams, result: w.RepoInfo },
  [N.reposList]: { params: w.ReposListParams, result: w.ReposListResult },
  [N.reposSetSetup]: { params: w.ReposSetSetupParams, result: w.ReposSetSetupResult },
  [N.fsTree]: { params: f.FsSessionParams, result: f.FsTreeResult },
  [N.fsRead]: { params: f.FsReadParams, result: f.FsReadResult },
  [N.fsWrite]: { params: f.FsWriteParams, result: f.FsWriteResult },
  [N.fsWatch]: { params: f.FsSessionParams, result: f.FsWatchResult },
  [N.usage]: { params: UsageParams, result: UsageResult },
} as const;

/** The name of a relay request method. */
export type RelayMethodName = keyof typeof RelayMethods;
/** The validated params type of a relay method. */
export type RelayParams<M extends RelayMethodName> = z.infer<(typeof RelayMethods)[M]["params"]>;
/** The validated result type of a relay method. */
export type RelayResult<M extends RelayMethodName> = z.infer<(typeof RelayMethods)[M]["result"]>;

/** Notifications the relay pushes to the app, with their params schemas. */
export const RelayNotifications = {
  [N.event]: s.EventNotificationParams,
  [N.fsChanged]: f.FsChangedParams,
} as const;
