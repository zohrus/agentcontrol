/** The environment of a machine where git cannot be found. */
export const machineWithoutGit = { PATH: "/nonexistent" };

/** The environment of a machine where git has no user name or email configured. */
export const machineWithoutGitIdentity = {
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};
