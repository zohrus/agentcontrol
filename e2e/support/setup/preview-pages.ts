/** A one-pixel PNG: real binary content, with bytes that are not valid text. */
export const PIXEL_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

/** A page that sets its own heading from a script, so a browser test can tell the script ran. */
export const GREETING_PAGE = `<!doctype html>
<html><body>
<h1 id="greeting">waiting for the script</h1>
<script>document.getElementById("greeting").textContent = "Hello from the agent";</script>
</body></html>
`;

/** A page made of several files in one folder: a stylesheet, a script and an image. */
export const SITE_PAGE = `<!doctype html>
<html><head><link rel="stylesheet" href="style.css"></head>
<body><h1 id="title">Site</h1><img id="logo" src="logo.png" alt="logo"><script src="app.js"></script></body></html>
`;

export const SITE_STYLE = "h1 { color: rgb(1, 2, 3); }\n";
export const SITE_SCRIPT = 'document.getElementById("title").textContent = "Site from app.js";\n';

/** A page whose script tries to reach the app's API, and writes what happened into the page. */
export const API_PROBING_PAGE = `<!doctype html>
<html><body><p id="result">trying</p>
<script>
fetch("/api/sessions")
  .then((response) => { document.getElementById("result").textContent = "reached the API: " + response.status; })
  .catch((error) => { document.getElementById("result").textContent = "blocked: " + error.name; });
</script></body></html>
`;

/** A page whose script sets its heading to `text`. */
export const pageSaying = (text: string): string => `<!doctype html>
<html><body><h1 id="greeting">not yet</h1>
<script>document.getElementById("greeting").textContent = ${JSON.stringify(text)};</script>
</body></html>
`;

/** Markdown with a heading, a table, a code block and a task list. */
export const RELEASE_NOTES = [
  "# Release notes",
  "",
  "| Name | Count |",
  "| ---- | ----- |",
  "| apples | 3 |",
  "",
  "```js",
  "const answer = 42;",
  "```",
  "",
  "- [x] shipped",
  "",
].join("\n");

/** Markdown that tries to run code: a script element and an image with an error handler. */
export const HOSTILE_NOTES = [
  "# Harmless heading",
  "",
  "<script>document.body.setAttribute('data-ran', 'yes')</script>",
  "",
  `<img src="missing.png" onerror="document.body.setAttribute('data-ran', 'yes')">`,
  "",
].join("\n");
