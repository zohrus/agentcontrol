/** Set by `bun build --define` in release builds (scripts/build/compile.ts). */
declare const AGENTCONTROL_VERSION: string | undefined;

/**
 * The version of this build, shared by the app and the relay so they can tell when they differ.
 * A release build has the release's version baked in; running from source it is "0.0.0".
 */
export const VERSION: string =
  typeof AGENTCONTROL_VERSION === "string" ? AGENTCONTROL_VERSION : "0.0.0";
