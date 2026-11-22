const languages: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  json: "json",
  css: "css",
  html: "html",
  md: "markdown",
  yml: "yaml",
  yaml: "yaml",
  py: "python",
  rs: "rust",
  go: "go",
  sh: "shell",
  sql: "sql",
};

/** Monaco language id for a file path, from its extension. */
export function languageOf(path: string): string {
  const extension = path.split(".").pop() ?? "";
  return languages[extension] ?? "plaintext";
}
