import { Button } from "../components/index.ts";

/** vscode:// URL that opens a worktree folder, or a file inside it, in desktop VS Code. */
export function vscodeUrl(worktreePath: string, filePath?: string): string {
  const root = worktreePath.replace(/\/+$/, "");
  return `vscode://file${root}${filePath ? `/${filePath}` : ""}`;
}

export function OpenInVSCode({ href }: { href: string }) {
  return (
    <Button asChild className="mb-1.5 px-2 py-0.5 text-[11px]">
      <a href={href}>Open in VS Code</a>
    </Button>
  );
}
