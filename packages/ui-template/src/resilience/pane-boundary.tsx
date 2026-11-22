import { Component, type ReactNode } from "react";
import { Button } from "../components/index.ts";

type Props = { name: string; children: ReactNode };
type State = { failed: boolean; attempt: number };

function Fallback({ name, onReload }: { name: string; onReload: () => void }) {
  return (
    <div role="alert" className="flex h-full flex-col items-start gap-2 p-4">
      <b className="font-medium">The “{name}” panel stopped working.</b>
      <p className="m-0 text-xs text-muted">
        The rest of the app is fine. If you changed this part of the UI recently, open “Modify this
        UI” and undo that change.
      </p>
      <Button variant="primary" onClick={onReload}>
        Reload this panel
      </Button>
    </div>
  );
}

/** Keeps a crash in one pane (for example from a broken customization) from blanking the app. */
export class PaneBoundary extends Component<Props, State> {
  override state: State = { failed: false, attempt: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true };
  }

  reload = (): void => {
    this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
  };

  override render(): ReactNode {
    if (this.state.failed) return <Fallback name={this.props.name} onReload={this.reload} />;
    return (
      <div key={this.state.attempt} className="h-full min-h-0">
        {this.props.children}
      </div>
    );
  }
}
