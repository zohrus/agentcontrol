import root from "../../../../package.json" with { type: "json" };

/**
 * The version of this AgentControl release, taken from the root package.json when the code is run
 * or built. The app, the relay and everything that reports a version use this one value; a relay
 * of another version than the app that talks to it needs an update.
 */
export const VERSION: string = root.version;
