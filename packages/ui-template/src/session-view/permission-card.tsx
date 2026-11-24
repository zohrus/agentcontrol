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

/** Says which answer is on its way to the agent, once one was chosen. */
function Sending({ item, sending }: Pick<Props, "item" | "sending">) {
  if (sending === undefined) return null;
  const name = item.options.find((option) => option.optionId === sending)?.name ?? sending;
  return (
    <span role="status" className="text-xs text-muted">
      Sending “{name}” to the agent…
    </span>
  );
}

/** One button per option (locked once one was chosen), or the answer once the agent has it. */
function Choices({ item, onAnswer, sending }: Props) {
  if (item.answer) return <span className="text-xs text-muted">Answered: {item.answer}</span>;
  return (
    <>
      <Sending item={item} sending={sending} />
      <div className="flex flex-wrap gap-2">
        {item.options.map((option) => (
          <OptionButton
            key={option.optionId}
            option={option}
            locked={sending !== undefined}
            onChoose={() => {
              onAnswer(item.requestId, option.optionId);
            }}
          />
        ))}
      </div>
    </>
  );
}

/** A pending permission request with one button per option, or the answer once given. */
export function PermissionCard(props: Props) {
  const { item } = props;
  if (item.automatic) return <AutomaticAnswer item={item} />;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-wait bg-wait-soft p-3">
      <b className="font-medium">{item.title}</b>
      {!item.answer && <Request item={item} />}
      <Choices {...props} />
    </div>
  );
}
