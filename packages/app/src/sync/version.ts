/** The relay a workspace runs is not the version of this app, so the app will not talk to it. */
export class RelayVersionMismatch extends Error {
  constructor(
    readonly relayVersion: string,
    readonly appVersion: string,
  ) {
    super(`The relay is version ${relayVersion}, but this app is version ${appVersion}.`);
  }
}
