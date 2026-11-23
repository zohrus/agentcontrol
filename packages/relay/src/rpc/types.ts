import type {
  RelayMethodName,
  RelayNotifications,
  RelayParams,
  RelayResult,
} from "@agentcontrol/protocol";
import type { z } from "zod";

/** The connected app, as a handler sees it. */
export interface Client {
  /** Pushes a notification to this client. */
  notify<N extends keyof typeof RelayNotifications>(
    method: N,
    params: z.infer<(typeof RelayNotifications)[N]>,
  ): void;
  /** Bytes already written for this client that it has not read yet; a slow reader makes it grow. */
  backlog(): number;
  /** Registers something to clean up when this client disconnects. */
  onClose(cleanup: () => void): void;
}

/** Handles one relay method: params are already validated. */
export type Handler<M extends RelayMethodName> = (
  params: RelayParams<M>,
  client: Client,
) => Promise<RelayResult<M>>;

/** One handler per relay method; the compiler insists none is missing. */
export type Handlers = { [M in RelayMethodName]: Handler<M> };
