import { footer } from "./footer.ts";
import layout from "./layout.json";
import { renderTable } from "./session-table.ts";

export const page = [layout.title, renderTable(), footer].join("\n");
