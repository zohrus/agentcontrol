import { createStore } from "../data/index.ts";

export type Toast = { id: number; message: string };

const SHOWN_FOR_MS = 8000;

export const toasts = createStore<readonly Toast[]>([]);
let nextId = 1;

export function dismissToast(id: number): void {
  toasts.update((list) => list.filter((toast) => toast.id !== id));
}

/** Shows a short message for a few seconds; the same message is not shown twice at once. */
export function showToast(message: string): void {
  if (toasts.get().some((toast) => toast.message === message)) return;
  const id = nextId++;
  toasts.update((list) => [...list, { id, message }]);
  setTimeout(() => {
    dismissToast(id);
  }, SHOWN_FOR_MS);
}
