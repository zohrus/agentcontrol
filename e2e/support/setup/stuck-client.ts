import { connect } from "node:net";
import { join } from "node:path";
import { onTestEnd } from "./cleanup.ts";
import type { RelayAccess } from "./relay.ts";

/** A client connected to the relay that answers a hang-up by not hanging up. */
export interface StuckClient {
  /** Resolves when the relay has finally hung up on this client. */
  readonly cutOff: Promise<void>;
}

/** Connects a client that keeps its side of the connection open however the relay ends its own. */
export async function connectsAClientThatNeverHangsUp(relay: RelayAccess): Promise<StuckClient> {
  const socket = connect({ path: join(relay.dataDir, "relay.sock"), allowHalfOpen: true });
  socket.on("error", () => undefined);
  const cutOff = new Promise<void>((resolve) => {
    socket.once("end", () => {
      resolve();
    });
  });
  await new Promise<void>((resolve) => {
    socket.once("connect", () => {
      resolve();
    });
  });
  onTestEnd(() => {
    socket.destroy();
    return Promise.resolve();
  });
  return { cutOff };
}
