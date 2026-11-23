import { Database } from "bun:sqlite";
import { join } from "node:path";
import type { AppAccess } from "./app.ts";

/**
 * Makes the events the app saved look as an older relay translated them: the agent's messages are
 * kept, but without the normalised `updates` a newer translation adds.
 */
export function makeSavedEventsLookOlderThanTheRelay(app: AppAccess): void {
  const database = new Database(join(app.dataDir, "state.db"));
  database.run(
    "UPDATE events SET payload_json = json_remove(payload_json, '$.updates') WHERE kind = 'acp'",
  );
  database.close();
}
