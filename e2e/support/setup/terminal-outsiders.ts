import { TERMINAL_PROTOCOL, TOKEN_PROTOCOL_PREFIX } from "@agentcontrol/protocol";
import type { AppAccess, Session } from "./app.ts";
import { type Answer, sendRaw } from "./raw-requests.ts";

interface Upgrade {
  /** The subprotocols the caller offers. */
  offered: string[];
  headers?: Record<string, string>;
  query?: string;
}

/** Asks for the session's terminal with the headers of a browser's WebSocket upgrade. */
function asksForTerminal(app: AppAccess, call: { session: Session; upgrade: Upgrade }) {
  const { session, upgrade } = call;
  return sendRaw(app, {
    path: `/api/sessions/${session.id}/terminal${upgrade.query ?? ""}`,
    headers: {
      upgrade: "websocket",
      connection: "Upgrade",
      "sec-websocket-version": "13",
      "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      "sec-websocket-protocol": upgrade.offered.join(", "),
      ...upgrade.headers,
    },
  });
}

/** Opens the terminal socket with the secret, sends `text`, and resolves with the close code. */
function closeCodeAfterSending(
  app: AppAccess,
  call: { session: Session; text: string },
): Promise<number> {
  const address = `${app.baseUrl.replace(/^http/, "ws")}/api/sessions/${call.session.id}/terminal`;
  const socket = new WebSocket(address, [
    TERMINAL_PROTOCOL,
    `${TOKEN_PROTOCOL_PREFIX}${app.token}`,
  ]);
  return new Promise((resolve) => {
    socket.addEventListener("open", () => {
      socket.send(call.text);
    });
    socket.addEventListener("close", (event) => {
      resolve(event.code);
    });
  });
}

const OTHER_SITE = { origin: "https://evil.example", "sec-fetch-site": "cross-site" };

/** Callers that try to open a terminal without being the app's own page. */
export function terminalOutsidersOf(app: AppAccess) {
  const withSecret = [TERMINAL_PROTOCOL, `${TOKEN_PROTOCOL_PREFIX}${app.token}`];
  const ask = (session: Session, upgrade: Upgrade): Promise<Answer> =>
    asksForTerminal(app, { session, upgrade });
  return {
    /** A page on another website, which knows the secret, asks for a terminal. */
    aWebsiteTriesToOpenATerminal: (session: Session) =>
      ask(session, { offered: withSecret, headers: OTHER_SITE }),
    /** A local program that holds no secret asks for a terminal. */
    aProgramWithoutTheTokenTriesToOpenATerminal: (session: Session) =>
      ask(session, { offered: [TERMINAL_PROTOCOL] }),
    /** A program offers a wrong secret. */
    aProgramWithAWrongTokenTriesToOpenATerminal: (session: Session) =>
      ask(session, { offered: [TERMINAL_PROTOCOL, `${TOKEN_PROTOCOL_PREFIX}not-the-secret`] }),
    /** The secret in the address (not in a subprotocol) is not accepted. */
    aProgramWithTheSecretInTheAddressTriesToOpenATerminal: (session: Session) =>
      ask(session, { offered: [TERMINAL_PROTOCOL], query: `?token=${app.token}` }),
    aProgramWithTheSecretAsksForTheTerminalOf: (session: Session) =>
      ask(session, { offered: withSecret }),
    aProgramWithTheSecretSendsGarbage: (session: Session): Promise<number> =>
      closeCodeAfterSending(app, { session, text: "this is not a message" }),
    /** A program with the secret asks with a plain GET, not a WebSocket upgrade. */
    aProgramWithTheSecretAsksWithAPlainRequest: (session: Session): Promise<Answer> =>
      sendRaw(app, {
        path: `/api/sessions/${session.id}/terminal`,
        headers: { authorization: `Bearer ${app.token}` },
      }),
  };
}
