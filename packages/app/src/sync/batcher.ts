/** Collects items and hands them over together once the burst has been quiet for `delayMs`. */
export interface Batcher<T> {
  add: (item: T) => void;
  /** Hands over what is waiting right now. */
  flush: () => void;
}

export function createBatcher<T>(options: {
  delayMs: number;
  handle: (items: T[]) => void;
}): Batcher<T> {
  let items: T[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = (): void => {
    clearTimeout(timer);
    timer = undefined;
    const ready = items;
    items = [];
    if (ready.length > 0) options.handle(ready);
  };
  return {
    flush,
    add: (item) => {
      items.push(item);
      timer ??= setTimeout(flush, options.delayMs);
    },
  };
}
