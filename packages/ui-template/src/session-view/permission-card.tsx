import type { PermissionOption } from "@agentcontrol/protocol";
import { Button } from "../components/index.ts";
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

/** An answer the relay gave by itself: refusals say why, in muted text; allowed edits show as tools. */
function AutomaticAnswer({ item }: { item: ItemOf<"permission"> }) {
  if (!item.automatic?.refused) return null;
  return (
    <span className="text-xs text-muted">
      Refused: {item.title}. {item.automatic.reason}
    </span>
  );
}

/** A pending permission request with one button per option, or the answer once given. */
export function PermissionCard({ item, onAnswer }: Props) {
  if (item.automatic) return <AutomaticAnswer item={item} />;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-wait bg-wait-soft p-3">
      <b className="font-medium">{item.title}</b>
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
