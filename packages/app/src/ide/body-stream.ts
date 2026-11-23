import type { IdeSignal } from "../sync/index.ts";

export interface BodyStreamOptions {
  /** The browser took `bytes` of the body: the relay may send that much more. */
  acknowledge: (bytes: number) => void;
  /** The browser stopped reading (it closed the tab): the relay should stop sending. */
  abandon: () => void;
}

/**
 * A response body fed by the relay's notifications. Nothing is taken from the queue until the
 * browser asks for more, and each piece is acknowledged only then, so the relay never has more
 * than its window (1 MiB) in flight and a slow browser holds the download back, not memory.
 */
export class BodyStream {
  readonly stream: ReadableStream<Uint8Array>;
  private readonly queue: Uint8Array[] = [];
  private ending: { error?: string | undefined } | undefined;
  private wake: () => void = () => undefined;

  constructor(private readonly options: BodyStreamOptions) {
    this.stream = new ReadableStream<Uint8Array>(
      {
        pull: (controller) => this.pull(controller),
        cancel: () => {
          options.abandon();
        },
      },
      { highWaterMark: 0 },
    );
  }

  /** What the relay reported about this response, in the order it arrived. */
  hear(signal: IdeSignal): void {
    if (signal.type === "body") this.queue.push(signal.data);
    else this.ending = { error: signal.type === "end" ? signal.error : LOST };
    this.wake();
  }

  private async pull(controller: ReadableStreamDefaultController<Uint8Array>): Promise<void> {
    while (!this.deliver(controller)) {
      await new Promise<void>((resume) => {
        this.wake = resume;
      });
    }
  }

  /** Hands the browser the next piece, or the end; false when there is nothing yet. */
  private deliver(controller: ReadableStreamDefaultController<Uint8Array>): boolean {
    const next = this.queue.shift();
    if (next === undefined) return this.finish(controller);
    controller.enqueue(next);
    this.options.acknowledge(next.length);
    return true;
  }

  private finish(controller: ReadableStreamDefaultController<Uint8Array>): boolean {
    if (this.ending === undefined) return false;
    if (this.ending.error === undefined) controller.close();
    else controller.error(new Error(this.ending.error));
    return true;
  }
}

const LOST = "The connection to the workspace was lost.";
