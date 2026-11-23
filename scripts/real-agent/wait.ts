const POLL_MS = 250;
const DEFAULT_TIMEOUT_MS = 120_000;

/** Polls until `read` returns a value, or fails with a plain sentence about what never happened. */
export async function waitFor<T>(options: {
  describe: string;
  read: () => Promise<T | undefined>;
  timeoutMs?: number;
}): Promise<T> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  for (;;) {
    const value = await options.read();
    if (value !== undefined) return value;
    if (Date.now() > deadline) {
      throw new Error(`expected ${options.describe}, but it never happened`);
    }
    await Bun.sleep(POLL_MS);
  }
}

/** A failed expectation of a scenario, worded as what was expected. */
export function expectThat(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
