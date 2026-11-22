const TIMEOUT_MS = 6000;
const POLL_MS = 40;

/**
 * Polls `observe` until it returns `undefined` (all is as expected) or the time is up. `observe`
 * says what it saw instead; the failure reads "<expectation>, but <what was seen>".
 */
export async function eventually(
  expectation: string,
  observe: () => Promise<string | undefined>,
  timeoutMs: number = TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let seen = await observe();
  while (seen !== undefined && Date.now() < deadline) {
    await Bun.sleep(POLL_MS);
    seen = await observe();
  }
  if (seen !== undefined) throw new Error(`${expectation}, but ${seen}`);
}
