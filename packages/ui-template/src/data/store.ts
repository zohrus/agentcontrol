import { useSyncExternalStore } from "react";

/** A value that many components read: change it with `update`, read it with `get` or a hook. */
export interface Store<S> {
  get: () => S;
  /** Replaces the state with what `change` returns; listeners run only when it is a new object. */
  update: (change: (state: S) => S) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<S>(initial: S): Store<S> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    update: (change) => {
      const next = change(state);
      if (next === state) return;
      state = next;
      for (const listener of [...listeners]) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Resolves once `done` holds for the state: at once when it does already, else after a change. */
export function untilStore<S>(store: Store<S>, done: (state: S) => boolean): Promise<void> {
  if (done(store.get())) return Promise.resolve();
  return new Promise((resolve) => {
    const stop = store.subscribe(() => {
      if (!done(store.get())) return;
      stop();
      resolve();
    });
  });
}

/** Re-renders the component when the selected part of the store changes. Selectors must not build new objects. */
export function useStoreValue<S, V>(store: Store<S>, select: (state: S) => V): V {
  return useSyncExternalStore(store.subscribe, () => select(store.get()));
}
