import { read } from "./api-error.ts";
import type { Api } from "./client-type.ts";
import type { ModifyState, UiVersionEntry } from "./types.ts";

/** Changing the UI itself: ask the Modify agent, Keep or Undo what it did, go back to a version. */
export function modifyApi(api: Api) {
  return {
    /** Where the Modify agent is: status, the check gate, changed files, a failure's reason, the update banner. */
    state: (): Promise<ModifyState> => read(api.modify.$get()) as Promise<ModifyState>,
    /**
     * Asks the Modify agent for a change, e.g. "add a cost column". Returns at once; follow
     * progress with `state()` or the `onModify` listener. Throws ApiError "modify-busy" while
     * another change is in progress or waiting for Keep or Undo.
     */
    request: (text: string): Promise<ModifyState> =>
      read(api.modify.$post({ json: { request: text } })) as Promise<ModifyState>,
    /** Keeps the change that is waiting in the live UI, as a version named after the request. */
    keep: (): Promise<ModifyState> => read(api.modify.keep.$post()) as Promise<ModifyState>,
    /** Undoes the waiting change; with none waiting, goes back one kept version. */
    undo: (): Promise<ModifyState> => read(api.modify.undo.$post()) as Promise<ModifyState>,
    /** Throws away a failed or running attempt; the live UI is not touched. */
    discard: (): Promise<ModifyState> => read(api.modify.discard.$post()) as Promise<ModifyState>,
    /** Saved versions of the UI, newest first. */
    history: async (): Promise<UiVersionEntry[]> => {
      const { versions } = await read(api.modify.history.$get());
      return versions as UiVersionEntry[];
    },
    /** Brings an earlier version back as a new one (`commit` from `history()`). */
    restore: (commit: string): Promise<ModifyState> =>
      read(api.modify.restore.$post({ json: { commit } })) as Promise<ModifyState>,
    /** Merges the available default-UI update; it then waits for Keep or Undo. */
    applyUpdate: (): Promise<ModifyState> =>
      read(api.modify.update.$post()) as Promise<ModifyState>,
  };
}
