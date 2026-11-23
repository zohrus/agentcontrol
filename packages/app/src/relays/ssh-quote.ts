/** The text as one word for the remote shell, whatever it contains. */
export const shellQuote = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/**
 * One word for the remote shell. A path starting with `~/` stays relative to the remote home
 * (`"$HOME"/...`), because the home folder is not known here; anything else is quoted as it is.
 */
export function remoteWord(path: string): string {
  if (!path.startsWith("~/")) return shellQuote(path);
  return `"$HOME"/${shellQuote(path.slice(2))}`;
}

/** Whether `host` can be handed to ssh as a destination: no leading dash, no spaces or quotes. */
export const isSafeHost = (host: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._@:-]*$/.test(host);
