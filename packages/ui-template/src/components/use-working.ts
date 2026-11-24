import { useRef, useState } from "react";

/**
 * For a button whose action takes a while. `run` starts the work; until it ends `working` is true
 * (the button says so and is disabled), and pressing again does nothing, even within the same tick.
 */
export function useWorking(): { working: boolean; run: (work: () => Promise<unknown>) => void } {
  const [working, setWorking] = useState(false);
  const started = useRef(false);
  const run = (work: () => Promise<unknown>): void => {
    if (started.current) return;
    started.current = true;
    setWorking(true);
    void work().finally(() => {
      started.current = false;
      setWorking(false);
    });
  };
  return { working, run };
}
