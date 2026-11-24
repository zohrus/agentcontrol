import type { AppAccess, Session } from "../setup/app.ts";
import type { IdeTab } from "../setup/ide-user.ts";

/** An upload over the tunnel's 16 MiB is refused with 413. */
export async function expectBigUploadToBeRefused(tab: IdeTab): Promise<void> {
  const body = new Uint8Array(17 * 1024 * 1024);
  const answer = await tab.loads("echo", { method: "POST", body });
  if (answer.status !== 413) {
    throw new Error(
      `expected a 17 MiB upload to be refused with 413, but it got ${String(answer.status)}`,
    );
  }
}

/** Opening the session's browser VS Code fails, and the reason says what code-server did. */
export async function expectOpeningToFailBecause(
  call: { app: AppAccess; session: Session },
  text: string,
): Promise<void> {
  const failure = await call.app.sdk.ide.openIde(call.session.id).then(
    () => undefined,
    (error: unknown) => error as Error,
  );
  if (failure?.message.includes(text) !== true) {
    throw new Error(`expected opening to fail with "${text}", but got ${String(failure?.message)}`);
  }
}
