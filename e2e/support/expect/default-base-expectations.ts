import type { AppAccess, Session } from "../setup/app.ts";

/** The session's worktree is made and its setup is over: the relay records that before it does more. */
function expectWorktreeToBeReady(app: AppAccess, session: Session): Promise<unknown> {
  return app.streamed.waitFor(
    (event) => event.sessionId === session.id && event.kind === "setup-finished",
    `expected the worktree of session "${session.title}" to be made`,
  );
}

/** The session's worktree holds this file with exactly this content. */
export async function expectSessionToHaveFile(
  app: AppAccess,
  call: { session: Session; path: string; content: string },
): Promise<void> {
  const { session, path, content } = call;
  await expectWorktreeToBeReady(app, session);
  const found = await app.sdk.files.read({ id: session.id, path }).catch(() => undefined);
  if (found?.content === content) return;
  const seen =
    found === undefined ? `no file ${path}` : `${path} reading ${JSON.stringify(found.content)}`;
  throw new Error(
    `expected session "${session.title}" to have ${path} reading ${JSON.stringify(content)}, but it has ${seen}`,
  );
}

/** The session's diff lists no changed file. */
export async function expectNoChangesInTheDiff(app: AppAccess, session: Session): Promise<void> {
  await expectWorktreeToBeReady(app, session);
  const { files } = await app.sdk.sessions.diff(session.id);
  if (files.length === 0) return;
  const listed = files.map((file) => file.path).join(", ");
  throw new Error(`expected session "${session.title}" to show no changes, but it lists ${listed}`);
}

/** The session says it started from this base. */
export async function expectSessionToStartFrom(
  app: AppAccess,
  call: { session: Session; base: string },
): Promise<void> {
  await expectWorktreeToBeReady(app, call.session);
  const { baseBranch } = await app.sdk.sessions.get(call.session.id);
  if (baseBranch === call.base) return;
  throw new Error(
    `expected session "${call.session.title}" to start from ${call.base}, but it starts from ${baseBranch}`,
  );
}

/** The session's setup output says this, before the agent starts. */
export async function expectSetupOutputToSay(
  app: AppAccess,
  call: { session: Session; text: string },
): Promise<void> {
  const { session, text } = call;
  await app.streamed.waitFor(
    (event) =>
      event.sessionId === session.id &&
      event.kind === "setup-output" &&
      event.payload.text.includes(text),
    `expected the setup output of session "${session.title}" to say "${text}"`,
  );
}
