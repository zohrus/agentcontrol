import { ErrorCode, RelayName } from "@agentcontrol/protocol";
import { relayRefusing } from "./refusing-relay.ts";
import type { Wire } from "./wire.ts";

/**
 * What zod said (shortened) when a relay from before sessions could be made without a prompt was
 * asked to make one: its message is the list of issues as JSON.
 */
const WHAT_THE_OLDER_RELAY_SAID = JSON.stringify(
  [
    {
      code: "invalid_union",
      errors: [
        [
          {
            expected: "string",
            code: "invalid_type",
            path: ["baseBranch"],
            message: "Invalid input: expected string, received undefined",
          },
          {
            expected: "string",
            code: "invalid_type",
            path: ["prompt"],
            message: "Invalid input: expected string, received undefined",
          },
        ],
      ],
      path: [],
      message: "Invalid input",
    },
  ],
  null,
  2,
);

/**
 * A connection to a relay that still runs the code from before a session could be created without a
 * prompt: asked for such a session it refuses the parameters as that code did, with zod's own list of
 * what was missing and nothing to tell it apart from the user's own mistake.
 */
export function aRelayThatStillWantsAPrompt(real: Wire): Wire {
  const refusal = { code: ErrorCode.invalidParams, message: WHAT_THE_OLDER_RELAY_SAID };
  return relayRefusing(real, (request) => {
    const asksForNoPrompt = !("prompt" in (request.params ?? {}));
    return request.method === RelayName.sessionsCreate && asksForNoPrompt ? refusal : undefined;
  });
}
