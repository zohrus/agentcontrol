import type { SessionEvent, WorkspaceInfo } from "@agentcontrol/sdk";
import type { AppAccess, FileChange } from "./app.ts";
import { Timeline } from "./timeline.ts";

const STREAM_WAIT_MS = 5000;

/** What the live stream has delivered so far. */
export interface Heard {
  streamed: Timeline<SessionEvent>;
  fileChanges: Timeline<FileChange>;
  /** One entry per relay connection the app has seen end, numbered from 1. */
  relayConnectionsEnded: Timeline<number>;
  workspaceChanges: Timeline<WorkspaceInfo>;
}

/** Opens the live stream and resolves once the app has confirmed it, so no event is missed. */
export function followLiveStream(sdk: AppAccess["sdk"], heard: Heard): Promise<() => void> {
  return new Promise((resolve) => {
    const stop = sdk.subscribe({
      onEvent: (event) => {
        heard.streamed.record(event);
      },
      onFilesChanged: (change) => {
        heard.fileChanges.record(change);
      },
      onWorkspace: (workspace) => {
        heard.workspaceChanges.record(workspace);
      },
      onOpen: () => {
        resolve(stop);
      },
    });
  });
}

export function newHeard(): Heard {
  return {
    streamed: new Timeline<SessionEvent>(STREAM_WAIT_MS),
    fileChanges: new Timeline<FileChange>(STREAM_WAIT_MS),
    relayConnectionsEnded: new Timeline<number>(STREAM_WAIT_MS),
    workspaceChanges: new Timeline<WorkspaceInfo>(STREAM_WAIT_MS),
  };
}

export function countEndedConnections(heard: Heard): () => void {
  return () => {
    heard.relayConnectionsEnded.record(heard.relayConnectionsEnded.entries.length + 1);
  };
}
