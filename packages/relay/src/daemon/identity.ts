import { VERSION } from "@agentcontrol/protocol";
import { buildIdentity } from "@agentcontrol/protocol/build-id";
import type { HostEnv } from "../agents/index.ts";

/**
 * What `relay/hello` says this relay is: this release's version and the build of its code. Only
 * tests change either, through the options or AGENTCONTROL_RELAY_VERSION and
 * AGENTCONTROL_RELAY_BUILD, to look like a relay that was started before an update.
 */
export function reportedIdentity(call: {
  options: { relayVersion?: string; buildId?: string };
  hostEnv: HostEnv;
}): { relayVersion: string; buildId: string } {
  const { options, hostEnv } = call;
  return {
    relayVersion: options.relayVersion ?? hostEnv["AGENTCONTROL_RELAY_VERSION"] ?? VERSION,
    buildId: options.buildId ?? hostEnv["AGENTCONTROL_RELAY_BUILD"] ?? buildIdentity(),
  };
}
