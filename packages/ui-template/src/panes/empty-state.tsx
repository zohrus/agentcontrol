import { Button } from "../components/index.ts";
import { useData } from "../data/index.ts";

type GuideProps = { title: string; text: string; action: string; onAction: () => void };

function Guide({ title, text, action, onAction }: GuideProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <h3 className="m-0 text-base font-semibold">{title}</h3>
      <p className="m-0 max-w-[340px] text-muted">{text}</p>
      <Button variant="primary" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

/** Shown in the session pane when nothing is open: guides a new user to the first step. */
export function EmptyState({ onNewSession }: { onNewSession: () => void }) {
  const loaded = useData((s) => s.loaded);
  const hasRepos = useData((s) => s.repos.length > 0);
  const hasSessions = useData((s) => s.sessions.length > 0);
  if (!loaded) return <p className="p-4 text-muted">Loading sessions…</p>;
  if (hasSessions) {
    return <p className="p-4 text-muted">Select a session to see what its agent is doing.</p>;
  }
  if (hasRepos) {
    return (
      <Guide
        title="No sessions yet"
        text="Start a session and an agent will work on your repository in its own copy of it."
        action="Start your first session"
        onAction={onNewSession}
      />
    );
  }
  return (
    <Guide
      title="Welcome to AgentControl"
      text="First, add a git repository. Agents work in their own copies of it, so your files stay untouched."
      action="Add a repository"
      onAction={onNewSession}
    />
  );
}
