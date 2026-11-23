import type { PermissionOption } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";
import { FileDiff } from "./file-diff.tsx";
import type { ItemOf } from "./view-items.ts";

type Props = {
  item: ItemOf<"permission">;
  onAnswer: (requestId: string, optionId: string) => void;
};

function OptionButton({ option, onChoose }: { option: PermissionOption; onChoose: () => void }) {
  const variant = option.kind === "allow_once" ? "primary" : "default";
  return (
    <Button variant={variant} onClick={onChoose}>
      {option.name}
    </Button>
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

/** A pending permission request with one button per option, or the answer once given. */
export function PermissionCard({ item, onAnswer }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-wait bg-wait-soft p-3">
      <b className="font-medium">{item.title}</b>
      {!item.answer && <Request item={item} />}
      {item.answer ? (
        <span className="text-xs text-muted">Answered: {item.answer}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {item.options.map((option) => (
            <OptionButton
              key={option.optionId}
              option={option}
              onChoose={() => {
                onAnswer(item.requestId, option.optionId);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
