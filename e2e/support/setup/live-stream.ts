import type { LiveSessionEvent, SessionRow } from "@agentcontrol/sdk";
import type { AppAccess } from "./app.ts";
import { onTestEnd } from "./cleanup.ts";
import { Timeline } from "./timeline.ts";

const STREAM_WAIT_MS = 5000;

/** A file change as the live stream delivers it. */
interface StreamedFileChange {
  workspaceId: string;
  sessionId: string;
  paths: string[];
}

/** What a browser listening to the app's live stream has heard, by kind of message. */
export interface LiveStream {
  /** Every session row the stream has pushed, in order. */
  readonly sessions: Timeline<SessionRow>;
  readonly events: Timeline<LiveSessionEvent>;
  readonly fileChanges: Timeline<StreamedFileChange>;
}

/**
 * Opens the live stream like a browser would and resolves once the app confirmed it. It only
 * listens: nothing here lists sessions or fetches anything, so what arrives was pushed.
 */
export function listensToTheLiveStream(app: AppAccess): Promise<LiveStream> {
  const stream: LiveStream = {
    sessions: new Timeline<SessionRow>(STREAM_WAIT_MS),
    events: new Timeline<LiveSessionEvent>(STREAM_WAIT_MS),
    fileChanges: new Timeline<StreamedFileChange>(STREAM_WAIT_MS),
  };
  return new Promise((resolve) => {
    const stop = app.sdk.subscribe({
      onSessions: (rows) => {
        rows.forEach((row) => {
          stream.sessions.record(row);
        });
      },
      onEvent: (event) => {
        stream.events.record(event);
      },
      onFilesChanged: (change) => {
        stream.fileChanges.record(change);
      },
      onOpen: () => {
        resolve(stream);
      },
    });
    onTestEnd(() => {
      stop();
      return Promise.resolve();
    });
  });
}
