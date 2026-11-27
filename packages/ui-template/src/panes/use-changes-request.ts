import { useState } from "react";

/** Something outside the Changes panel (the session header) asking it to show its Changes tab. */
export type ChangesRequest = {
  /** Goes up by one each time the changes are asked for. */
  asked: number;
  ask: () => void;
};

export function useChangesRequest(): ChangesRequest {
  const [asked, setAsked] = useState(0);
  return {
    asked,
    ask: () => {
      setAsked((count) => count + 1);
    },
  };
}
