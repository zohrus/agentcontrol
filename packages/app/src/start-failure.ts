/** A busy port gets a plain message that says what to do; every other failure is kept as it is. */
export function explainStartFailure(error: unknown, port: number): unknown {
  if (!(error instanceof Error) || (error as { code?: string }).code !== "EADDRINUSE") return error;
  return new Error(
    `Port ${String(port)} is already in use. AgentControl may already be running: open http://127.0.0.1:${String(port)}. To run another copy, pick a free port, for example: bun dev --port ${String(port + 1)}`,
    { cause: error },
  );
}
