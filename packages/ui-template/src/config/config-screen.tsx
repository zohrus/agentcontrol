import type { RepoInfo } from "@agentcontrol/protocol";
import { Dialog } from "../components/index.ts";
import type { ConfigState } from "../data/index.ts";
import { AppliedView } from "./applied-view.tsx";
import { titlesOf } from "./config-items.ts";
import { DriftBanner } from "./drift-banner.tsx";
import { ImportView } from "./import-view.tsx";
import { ItemsView } from "./items-view.tsx";
import { ReviewView } from "./review-view.tsx";
import type { ConfigActions } from "./types.ts";
import { useConfigScreen } from "./use-config-screen.ts";

export type ConfigScreenProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: ConfigState;
  repos: readonly RepoInfo[];
  actions: ConfigActions;
};

type Screen = ReturnType<typeof useConfigScreen>;
type PartProps = { props: ConfigScreenProps; screen: Screen };

function Review({ props, screen }: PartProps) {
  const { plan, applied, undoBlockedBy, items } = props.state;
  if (applied) {
    return (
      <AppliedView
        applied={applied}
        changedSince={undoBlockedBy}
        onUndo={(force) => void screen.undo(force)}
        onDone={screen.done}
      />
    );
  }
  if (!plan) return null;
  return (
    <ReviewView
      plan={plan}
      agents={screen.agents}
      titles={titlesOf(items)}
      onApply={() => void props.actions.apply()}
      onBack={screen.done}
    />
  );
}

function Notice({ text }: { text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p role="status" className="m-0 border-b border-line px-4 py-2 text-xs text-done">
      {text}
    </p>
  );
}

function Items({ props, screen }: PartProps) {
  const { state, repos } = props;
  const drifted = (state.drift?.entries ?? []).filter((entry) => entry.status !== "in-sync");
  return (
    <>
      <Notice text={screen.notice} />
      <DriftBanner
        entries={drifted}
        titles={titlesOf(state.items)}
        onKeep={(entry) => void screen.keepEdit(entry)}
        onOverwrite={() => void screen.review()}
      />
      <ItemsView
        screen={screen}
        items={state.items}
        repos={repos}
        unsupported={state.plan?.unsupported ?? []}
      />
    </>
  );
}

function Body({ props, screen }: PartProps) {
  const { found } = props.state;
  if (screen.view === "review") return <Review props={props} screen={screen} />;
  if (screen.view !== "import" || !found) return <Items props={props} screen={screen} />;
  return (
    <ImportView
      found={found}
      onAdopt={(items) => void screen.adopt(items)}
      onBack={() => {
        props.actions.forgetFound();
        screen.goTo("items");
      }}
    />
  );
}

/** The Config screen: every agent's MCP servers, rules, hooks, skills and more, set up once. */
export function ConfigScreen(props: ConfigScreenProps) {
  const screen = useConfigScreen({
    open: props.open,
    items: props.state.items,
    actions: props.actions,
  });
  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      placement="wide"
      title="Config"
      description="Set up MCP servers, instructions, permissions, hooks, skills and commands once. Nothing is written to your agents' files until you review and apply."
    >
      <Body props={props} screen={screen} />
    </Dialog>
  );
}
