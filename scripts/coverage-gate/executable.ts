const typescript = new Bun.Transpiler({ loader: "ts" });
const tsx = new Bun.Transpiler({ loader: "tsx" });
const COMMENT_START = /^(\/\/|\/\*|\*)/;

/** True when the file compiles to nothing (types only), so it has no lines to run. */
function isTypeOnly(file: string, source: string): boolean {
  const transpiler = file.endsWith(".tsx") ? tsx : typescript;
  return (
    transpiler
      .transformSync(source)
      .replace(/export\s*\{\s*\};?/g, "")
      .trim() === ""
  );
}

/**
 * The lines of a file no test loaded, as best we can tell without running it: lines that are
 * neither blank nor comments. Loaded files use the runtime's own list of executable lines.
 */
export async function guessExecutableLines(file: string): Promise<number[]> {
  const source = await Bun.file(file).text();
  if (isTypeOnly(file, source)) return [];
  return source
    .split("\n")
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => /[A-Za-z0-9]/.test(text) && !COMMENT_START.test(text))
    .map(({ line }) => line);
}
