import { Fragment, type ReactNode } from "react";
import { AgentMessage, Thought, UserMessage } from "./message-items.tsx";
import { PermissionCard } from "./permission-card.tsx";
import { PlanCard } from "./plan-card.tsx";
import { AgentExited, ModeLine, Notice, SetupOutput, TurnEnded } from "./status-items.tsx";
import { ToolCard } from "./tool-card.tsx";
import { ToolGroup } from "./tool-group.tsx";
import type { ItemOf, ItemType, ViewItem } from "./view-items.ts";

export type ItemActions = { onAnswerPermission: (requestId: string, optionId: string) => void };

type Renderers = { [K in ItemType]: (item: ItemOf<K>, actions: ItemActions) => ReactNode };

/** One renderer per kind of stream item. */
const renderers: Renderers = {
  user: (item) => <UserMessage item={item} />,
  message: (item) => <AgentMessage item={item} />,
  thought: (item) => <Thought item={item} />,
  plan: (item) => <PlanCard item={item} />,
  tool: (item) => <ToolCard item={item} />,
  "tool-group": (item) => <ToolGroup item={item} />,
  mode: (item) => <ModeLine item={item} />,
  permission: (item, actions) => (
    <PermissionCard item={item} onAnswer={actions.onAnswerPermission} />
  ),
  setup: (item) => <SetupOutput item={item} />,
  "turn-ended": (item) => <TurnEnded item={item} />,
  "agent-exited": (item) => <AgentExited item={item} />,
  notice: (item) => <Notice item={item} />,
};

function renderOne<K extends ItemType>(kind: K, item: ItemOf<K>, actions: ItemActions): ReactNode {
  return renderers[kind](item, actions);
}

export function StreamItem({ item, actions }: { item: ViewItem; actions: ItemActions }) {
  return <Fragment>{renderOne(item.type, item, actions)}</Fragment>;
}
