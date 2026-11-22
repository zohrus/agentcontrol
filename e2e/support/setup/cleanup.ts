const cleanups: Array<() => Promise<unknown>> = [];

/** Registers something to tear down (a subprocess, a temp folder) when the test ends. */
export function onTestEnd(cleanup: () => Promise<unknown>): void {
  cleanups.push(cleanup);
}

/** Call from `afterEach`. Runs the teardowns one at a time, last-in first-out. */
export async function cleanUpAfterTest(): Promise<void> {
  const pending = cleanups.splice(0).reverse();
  await pending.reduce((done, cleanup) => done.then(cleanup), Promise.resolve<unknown>(undefined));
}
