const WITH_VALUE = new Set([
  "--socket",
  "--socket-mode",
  "--auth",
  "--user-data-dir",
  "--extensions-dir",
  "--config",
]);

/** The command line as code-server reads it: `--flag value` pairs, bare flags, and the folder last. */
export function flagsOf(args: string[]) {
  const values = new Map<string, string>();
  args.forEach((arg, at) => {
    if (WITH_VALUE.has(arg)) values.set(arg, args[at + 1] ?? "");
  });
  const positional = args.filter(
    (arg, at) => !arg.startsWith("--") && !WITH_VALUE.has(args[at - 1] ?? ""),
  );
  return {
    value: (name: string): string | undefined => values.get(name),
    folder: (): string | undefined => positional.at(-1),
  };
}
