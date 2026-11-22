import type { AppType } from "@agentcontrol/app";
import type { hc } from "hono/client";

/** Hono's typed client for the app's API. */
export type Api = ReturnType<typeof hc<AppType>>;
