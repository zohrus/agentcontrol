import type { SessionId } from "@agentcontrol/protocol";
import type { PermissionAnswer, PermissionRequest } from "../agents/index.ts";

export interface PendingPermissions {
  /** Registers a request and returns a promise that resolves when the user answers it. */
  hold(sessionId: SessionId, request: PermissionRequest): Promise<PermissionAnswer>;
  /** Resolves a held request; returns false when no such request is pending. */
  answer(sessionId: SessionId, requestId: string, answer: PermissionAnswer): boolean;
  /** Pending requests of a session, oldest first. */
  pending(sessionId: SessionId): PermissionRequest[];
  /** Cancels every pending request of a session (agent stopped or session archived). */
  cancelAll(sessionId: SessionId): void;
}

interface Held {
  request: PermissionRequest;
  resolve: (answer: PermissionAnswer) => void;
}

export function createPendingPermissions(): PendingPermissions {
  const held = new Map<SessionId, Map<string, Held>>();
  const of = (sessionId: SessionId) => held.get(sessionId) ?? new Map<string, Held>();
  return {
    hold: (sessionId, request) =>
      new Promise((resolve) => {
        const requests = of(sessionId);
        requests.set(request.requestId, { request, resolve });
        held.set(sessionId, requests);
      }),
    answer: (sessionId, requestId, answer) => {
      const entry = of(sessionId).get(requestId);
      if (!entry) return false;
      of(sessionId).delete(requestId);
      entry.resolve(answer);
      return true;
    },
    pending: (sessionId) => [...of(sessionId).values()].map((entry) => entry.request),
    cancelAll: (sessionId) => {
      for (const entry of of(sessionId).values()) entry.resolve({ cancelled: true });
      held.delete(sessionId);
    },
  };
}
