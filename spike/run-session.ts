import {
  client,
  methods,
  PROTOCOL_VERSION,
  type InitializeResponse,
  type PermissionOption,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type Stream,
  type ClientConnection,
} from "@agentclientprotocol/sdk";
import type { createLogger } from "./message-log.ts";

type Log = ReturnType<typeof createLogger>;

/** Chooses the first "allow once" option; cancels when there is none. */
export function answerPermission(
  request: RequestPermissionRequest,
  log: Log,
): RequestPermissionResponse {
  const choice: PermissionOption | undefined = request.options.find((o) => o.kind === "allow_once");
  log("note", { permissionRequest: request, chose: choice?.optionId ?? "cancelled" });
  if (!choice) return { outcome: { outcome: "cancelled" } };
  return { outcome: { outcome: "selected", optionId: choice.optionId } };
}

/** A client that advertises no fs and no terminal and logs everything via the stream tap. */
export function connectClient(stream: Stream, log: Log): ClientConnection {
  return client({ name: "acp-spike" })
    .onRequest(methods.client.session.requestPermission, ({ params }) =>
      answerPermission(params, log),
    )
    .onNotification("*", () => undefined)
    .connect(stream);
}

export function initialize(conn: ClientConnection): Promise<InitializeResponse> {
  return conn.agent.request(methods.agent.initialize, {
    protocolVersion: PROTOCOL_VERSION,
    clientCapabilities: {},
    clientInfo: { name: "agentcontrol-spike", version: "0.0.0" },
  });
}

export async function runPrompt(
  conn: ClientConnection,
  args: { sessionId: string; prompt: string },
): Promise<string> {
  const response = await conn.agent.request(methods.agent.session.prompt, {
    sessionId: args.sessionId,
    prompt: [{ type: "text", text: args.prompt }],
  });
  return response.stopReason;
}
