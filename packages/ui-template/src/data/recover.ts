const RELOADED = "agentcontrol-reloaded-for-token";

function remember(value: string | undefined): boolean {
  try {
    if (value === undefined) sessionStorage.removeItem(RELOADED);
    else sessionStorage.setItem(RELOADED, value);
    return true;
  } catch {
    return false;
  }
}

function alreadyReloaded(): boolean {
  try {
    return sessionStorage.getItem(RELOADED) !== null;
  } catch {
    return true;
  }
}

/**
 * The app refused our secret: it restarted after this page was loaded and made a new one. Reload
 * once to get the page with the new secret. If the reload does not help, do not loop.
 */
export function reloadOnceWhenUnauthorized(): void {
  if (alreadyReloaded() || !remember("yes")) return;
  location.reload();
}

/** The app accepted us again; a later restart may reload once more. */
export function forgetReload(): void {
  remember(undefined);
}
