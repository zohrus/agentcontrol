const singleQuoted = (text: string): string => `'${text.replaceAll("'", `'\\''`)}'`;

/**
 * One word for the remote shell. A path starting with `~/` stays relative to the remote home
 * (`"$HOME"/...`), because the home folder is not known here; anything else is quoted as it is.
 */
export function remoteWord(path: string): string {
  if (!path.startsWith("~/")) return singleQuoted(path);
  return `"$HOME"/${singleQuoted(path.slice(2))}`;
}

/** Whether `host` can be handed to ssh as a destination: no leading dash, no spaces or quotes. */
export const isSafeHost = (host: string): boolean => /^[A-Za-z0-9][A-Za-z0-9._@:-]*$/.test(host);
