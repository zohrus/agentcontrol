import { formatDuration } from "@agentcontrol/protocol";
import { useEffect, useState } from "react";

/** How long it has been since `since`, counting up every second until unmounted. */
export function RunningFor({ since }: { since: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <span className="tabular-nums">{formatDuration(Math.max(0, now - Date.parse(since)))}</span>
  );
}
