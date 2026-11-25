import type { PermissionOption } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";
import { FileDiff } from "./file-diff.tsx";
import type { ItemOf } from "./view-items.ts";

type Props = {
  item: ItemOf<"permission">;
  onAnswer: (requestId: string, optionId: string) => void;
  /** The option chosen whose answer is on its way to the agent, when there is one. */
  sending?: string | undefined;
};

type OptionProps = { option: PermissionOption; onChoose: () => void; locked: boolean };

function OptionButton({ option, onChoose, locked }: OptionProps) {
  const variant = option.kind === "allow_once" ? "primary" : "default";
  return (
    <Button variant={variant} onClick={onChoose} disabled={locked}>
      {option.name}
    </Button>
  );
}

/** An answer the relay gave by itself: refusals say why, in muted text; allowed edits show as tools. */
function AutomaticAnswer({ item }: { item: ItemOf<"permission"> }) {
  if (!item.automatic?.refused) return null;
  return (
    <span className="text-xs text-muted">
      Refused: {item.title}. {item.automatic.reason}
    </span>
  );
}

/** What the agent wants to do: the command it would run, or the changes it would make. */
function Request({ item }: { item: ItemOf<"permission"> }) {
  return (
    <>
      {item.command && (
        <code className="overflow-x-auto whitespace-pre rounded-md bg-surface px-2 py-1 font-mono text-xs">
          $ {item.command}
        </code>
      )}
      {item.files.map((change, index) => (
        <FileDiff key={`${change.path}-${String(index)}`} change={change} />
      ))}
    </>
  );
}

/** What is on its way: the option chosen, until the agent has the answer. */
function sendingText({ item, sending }: Pick<Props, "item" | "sending">): string {
  if (sending === undefined || item.answer) return "";
  const name = item.options.find((option) => option.optionId === sending)?.name ?? sending;
  return `Sending “${name}” to the agent…`;
}

/** Says which answer is on its way to the agent, in a line that is there, empty, from the start. */
function Sending(props: Pick<Props, "item" | "sending">) {
  return (
    <span role="status" className="block h-4 text-xs text-muted">
      {sendingText(props)}
    </span>
  );
}

/**
 * One button per option (locked once one was chosen). Once the agent has the answer the buttons
 * give way to it in the same cell, so the row keeps its height whatever the buttons did.
 */
function Choices({ item, onAnswer, sending }: Props) {
  return (
    <div className="grid">
      <div
        className={`col-start-1 row-start-1 flex flex-wrap gap-2 ${item.answer ? "invisible" : ""}`}
      >
        {item.options.map((option) => (
          <OptionButton
            key={option.optionId}
            option={option}
            locked={sending !== undefined || Boolean(item.answer)}
            onChoose={() => {
              onAnswer(item.requestId, option.optionId);
            }}
          />
        ))}
      </div>
      {item.answer && (
        <span className="col-start-1 row-start-1 self-center text-xs text-muted">
          Answered: {item.answer}
        </span>
      )}
    </div>
  );
}

/** A pending permission request with one button per option, or the answer once given. */
export function PermissionCard(props: Props) {
  const { item } = props;
  if (item.automatic) return <AutomaticAnswer item={item} />;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-wait bg-wait-soft p-3">
      <b className="font-medium">{item.title}</b>
      <Request item={item} />
      <Choices {...props} />
      <Sending item={item} sending={props.sending} />
    </div>
  );
}
