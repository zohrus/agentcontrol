import type { AppAccess } from "./app.ts";

/** More of what a person does with the Modify agent: look at its folder, restore, apply an update. */
export function modifyMoreUserOf(app: AppAccess) {
  return {
    /** A double click on Keep: two requests at the same moment. */
    pressesKeepTwiceAtOnce: () =>
      Promise.allSettled([app.sdk.modify.keep(), app.sdk.modify.keep()]),
    /** The files the Modify agent's session lists, as the UI's file tree shows them. */
    listsTheModifyAgentsFiles: async () => {
      const { sessionId } = await app.sdk.modify.state();
      if (!sessionId)
        throw new Error("expected the Modify agent to have a session, but it has none");
      return (await app.sdk.files.tree(sessionId)).map((entry) => entry.path);
    },
    asksForTheModifyAgentsDiff: async () => {
      const { sessionId } = await app.sdk.modify.state();
      if (!sessionId)
        throw new Error("expected the Modify agent to have a session, but it has none");
      return app.sdk.sessions.diff(sessionId);
    },
  };
}
