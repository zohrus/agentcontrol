import type { ConfigAgent, RepoInfo, ScopedItem, UnsupportedItem } from "@agentcontrol/protocol";
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useWorking,
} from "../components/index.ts";
import { agentName, allAgents } from "./agents.ts";
import { ItemEditor } from "./item-editor.tsx";
import { ItemList } from "./item-list.tsx";
import type { Kind } from "./kind-spec.ts";
import { kindOrder, kindSpecs, ofKind } from "./kind-specs.ts";
import type { useConfigScreen } from "./use-config-screen.ts";

type Screen = ReturnType<typeof useConfigScreen>;

export type ItemsViewProps = {
  screen: Screen;
  items: readonly ScopedItem[];
  repos: readonly RepoInfo[];
  unsupported: readonly UnsupportedItem[];
};

function AgentChoice({ agent, screen }: { agent: ConfigAgent; screen: Screen }) {
  const on = screen.agents.includes(agent);
  const others = screen.agents.filter((chosen) => chosen !== agent);
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={on}
        onChange={() => {
          screen.setAgents(on ? others : [...others, agent]);
        }}
      />
      {agentName(agent)}
    </label>
  );
}

function Toolbar({ screen }: { screen: Screen }) {
  const importing = useWorking();
  const reviewing = useWorking();
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-2 text-xs">
      <span className="font-medium">Write to</span>
      {allAgents.map((agent) => (
        <AgentChoice key={agent} agent={agent} screen={screen} />
      ))}
      <Button
        className="ml-auto"
        disabled={importing.working}
        onClick={() => {
          importing.run(screen.importExisting);
        }}
      >
        {importing.working ? "Looking…" : "Import existing setup"}
      </Button>
      <Button
        variant="primary"
        disabled={screen.agents.length === 0 || reviewing.working}
        onClick={() => {
          reviewing.run(screen.review);
        }}
      >
        {reviewing.working ? "Reviewing…" : "Review changes"}
      </Button>
    </div>
  );
}

function KindTab({ kind, props }: { kind: Kind; props: ItemsViewProps }) {
  const { screen, items, unsupported } = props;
  return (
    <TabsContent value={kind}>
      <ItemList
        kind={kind}
        items={ofKind(items, kind)}
        unsupported={unsupported}
        onAdd={() => {
          screen.edit({ kind });
        }}
        onEdit={(initial) => {
          screen.edit({ kind, initial });
        }}
        onDelete={(gone) => void screen.remove(gone)}
        onToggle={(one) => void screen.toggle(one)}
      />
    </TabsContent>
  );
}

function Kinds({ props }: { props: ItemsViewProps }) {
  const { screen } = props;
  return (
    <Tabs
      value={screen.kind}
      onValueChange={(value) => {
        const next = kindOrder.find((candidate) => candidate === value);
        if (next) screen.setKind(next);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="border-b border-line px-2">
        {kindOrder.map((kind) => (
          <TabsTrigger key={kind} value={kind}>
            {kindSpecs[kind].label}
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {kindOrder.map((kind) => (
          <KindTab key={kind} kind={kind} props={props} />
        ))}
      </div>
    </Tabs>
  );
}

/** The items by kind, with Review changes and Import existing setup, and the editor when open. */
export function ItemsView(props: ItemsViewProps) {
  const { screen, items, repos } = props;
  return (
    <>
      <Toolbar screen={screen} />
      <Kinds props={props} />
      {screen.editing && (
        <ItemEditor
          kind={screen.editing.kind}
          initial={screen.editing.initial}
          repos={repos}
          takenIds={new Set(items.map((scoped) => scoped.item.id))}
          onSave={(scoped) => void screen.saveEdited(scoped)}
          onCancel={() => {
            screen.edit(undefined);
          }}
        />
      )}
    </>
  );
}
