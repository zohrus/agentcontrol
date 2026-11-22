// Detects dependency changes in package.json files, comparing a base version with a new one.
const SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
  "overrides",
];

function sections(text: string | null): string {
  if (text === null) return "";
  const json = JSON.parse(text) as Record<string, unknown>;
  return JSON.stringify(SECTIONS.map((key) => json[key] ?? null));
}

/** True when the dependency sections of two package.json texts differ (null means no file). */
export function dependenciesChanged(before: string | null, after: string | null): boolean {
  return sections(before) !== sections(after);
}

export function isPackageJson(path: string): boolean {
  return path === "package.json" || path.endsWith("/package.json");
}
