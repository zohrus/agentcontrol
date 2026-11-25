import { footer } from "./footer.ts";
import layout from "./layout.json";
import { renderTable } from "./session-table.ts";

export const page = [layout.title, renderTable(), footer].join("\n");

// What the browser shows: the same text, so that a built page can be told from another. (The
// repository's type check reads this file without the browser's types.)
declare const document: { body: { textContent: string } };
document.body.textContent = page;
