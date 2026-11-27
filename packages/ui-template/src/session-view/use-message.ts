import { useState } from "react";
import type { QueuedView, QueueProps } from "./queue-list.tsx";

type Call = {
  /** The agent is busy (a turn runs or the session starts): the message waits in the queue. */
  busy: boolean;
  queue: QueueProps | undefined;
  onSendPrompt: (text: string) => void;
};

/** True when the message must wait its turn: the agent is busy, or older messages are still waiting. */
function mustWait({ busy, queue }: Call): boolean {
  if (queue === undefined) return false;
  const queueIsMoving = queue.messages.length > 0 && !queue.paused;
  return busy || queueIsMoving;
}

/** What goes in the box when a queued message is taken back: it comes first, then what was already written. */
const withTakenBack = (taken: string, written: string): string =>
  written.trim() === "" ? taken : `${taken}\n\n${written}`;

/** The text being written, and what Send does with it: queue it while the agent is busy, else send it. */
export function useMessage(call: Call) {
  const [text, setText] = useState("");
  const send = () => {
    if (text.trim() === "") return;
    const trimmed = text.trim();
    if (mustWait(call)) call.queue?.onQueue(trimmed);
    else call.onSendPrompt(trimmed);
    setText("");
  };
  const edit = (message: QueuedView) => {
    call.queue?.onRemove(message.id);
    setText((written) => withTakenBack(message.text, written));
  };
  return { text, setText, send, edit };
}
