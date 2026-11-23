import type { AppAccess, Session } from "./app.ts";
import { attemptApi } from "./app-attempt.ts";

/** Getting an interrupted session going again in the app, through the SDK. */
export function appResumeUserOf(app: AppAccess) {
  return {
    resumesSession: (session: Session) => app.sdk.sessions.resume(session.id),
    triesToResumeSession: (session: Session) => attemptApi(app.sdk.sessions.resume(session.id)),
  };
}
