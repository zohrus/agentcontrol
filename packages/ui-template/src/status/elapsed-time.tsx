import { useEffect, useState } from "react";
import { formatElapsed } from "./format.ts";

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 15_000);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
  return now;
}

type Props = { since: string; until?: string | undefined };

/** Time since `since`; stops counting at `until` (for finished or archived sessions). */
export function ElapsedTime({ since, until }: Props) {
  const now = useNow(until === undefined);
  const end = until === undefined ? now : Date.parse(until);
  return (
    <span className="font-mono text-[11px] text-muted" title={`Started ${since}`}>
      {formatElapsed(end - Date.parse(since))}
    </span>
  );
}
