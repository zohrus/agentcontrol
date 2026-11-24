import { VERSION } from "@agentcontrol/protocol";
import { buildIdentity } from "@agentcontrol/protocol/build-id";

/** What a relay says it is: its release, and the code it runs (absent from a relay that predates it). */
export interface RelayIdentity {
  version: string;
  build: string | undefined;
}

/**
 * How the relay differs from the app, in plain words, or undefined when it is the app's own. A
 * version number alone cannot tell: every commit of a release has the same one, so a relay that
 * was started before the app's code was updated looks current but answers requests the old way.
 */
export function relayMismatch(relay: RelayIdentity): string | undefined {
  if (relay.version !== VERSION) {
    return `The relay is version ${relay.version}, but this app is version ${VERSION}.`;
  }
  const own = buildIdentity();
  if (relay.build === own) return undefined;
  const theirs = relay.build === undefined ? "an older one that reports none" : relay.build;
  return `The relay runs other code than this app, although both are version ${VERSION} (relay build ${theirs}, app build ${own}). It was probably started before the app was updated.`;
}
