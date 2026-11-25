import { Fragment, memo, type ReactNode } from "react";
import { AgentMessage, UserMessage } from "./message-items.tsx";
import { PermissionCard } from "./permission-card.tsx";
import { PlanCard } from "./plan-card.tsx";
import { SetupOutput } from "./setup-block.tsx";
import { AgentExited, ModeLine, Notice, TurnEnded } from "./status-items.tsx";
import { Thought } from "./thought.tsx";
import { ToolCard } from "./tool-card.tsx";
import { ToolGroup } from "./tool-group.tsx";
import type { ItemOf, ItemType, ViewItem } from "./view-items.ts";

export type ItemActions = {
  onAnswerPermission: (requestId: string, optionId: string) => void;
  /** The permission requests whose answer is on its way: request id to the option chosen. */
  answering: Readonly<Record<string, string>>;
  onRetryMessage: (localId: string) => void;
  onDismissMessage: (localId: string) => void;
};

/** What the stream draws through `StreamItem`: a message on its way has its own row (`SentMessage`). */
type Drawn = Exclude<ItemType, "outgoing">;
type Renderers = { [K in Drawn]: (item: ItemOf<K>, actions: ItemActions) => ReactNode };

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
    <PermissionCard
      item={item}
      onAnswer={actions.onAnswerPermission}
      sending={actions.answering[item.requestId]}
    />
  ),
  setup: (item) => <SetupOutput item={item} />,
  "turn-ended": (item) => <TurnEnded item={item} />,
  "agent-exited": (item) => <AgentExited item={item} />,
  notice: (item) => <Notice item={item} />,
};

function renderOne<K extends Drawn>(kind: K, item: ItemOf<K>, actions: ItemActions): ReactNode {
  return renderers[kind](item, actions);
}

type DrawnItem = Exclude<ViewItem, { type: "outgoing" }>;
type Props = { item: DrawnItem; actions: ItemActions };

/** Whether the item's own buttons would act differently: only a permission has any. */
function sameActions(item: DrawnItem, call: { before: ItemActions; after: ItemActions }): boolean {
  const { before, after } = call;
  if (item.type === "permission") {
    return (
      before.onAnswerPermission === after.onAnswerPermission &&
      before.answering[item.requestId] === after.answering[item.requestId]
    );
  }
  return true;
}

/** One item of the stream. An item that has not changed is not drawn again. */
export const StreamItem = memo(
  function StreamItem({ item, actions }: Props) {
    return <Fragment>{renderOne(item.type, item, actions)}</Fragment>;
  },
  (before, after) =>
    before.item === after.item &&
    sameActions(after.item, { before: before.actions, after: after.actions }),
);
