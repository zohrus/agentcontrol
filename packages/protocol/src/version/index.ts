import own from "../../package.json" with { type: "json" };

/**
 * The version of this AgentControl release, taken from this package's own package.json, which ships
 * wherever this code does (the root package.json does not exist in a release folder). The build
 * refuses to run when the two versions differ. The app, the relay and everything that reports a version use this one value; a relay
 * of another version than the app that talks to it needs an update.
 */
export const VERSION: string = own.version;
