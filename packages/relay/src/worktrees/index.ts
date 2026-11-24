export {
  addWorktree,
  checkBaseBranch,
  namedBase,
  planWorktree,
  portBaseFor,
  portEnv,
  resolveStartPoint,
} from "./create.ts";
export type { PlannedWorktree } from "./create.ts";
export { diffWorktree } from "./diff.ts";
export { removeWorktree, sweepMovedWorktrees } from "./remove.ts";
export { runSetupScript } from "./setup-script.ts";
export { uncommittedFiles } from "./status.ts";
