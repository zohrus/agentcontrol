# How previewed pages are fenced in (2026-11-22)

Author: preview agent. Part of the Preview tab (`docs/plan.html`, "Preview tab").

## Context

The Preview tab runs HTML that an agent wrote. That page must not be able to call the AgentControl
API (which will require a bearer token), read the token, read another session's files, or touch
the app page around it. An iframe cannot send the bearer header, so the route cannot use it.

## Decision

- **Route.** `GET /preview/<ticket>/<path>` on the app, outside `/api` and never an app document:
  the UI handler does not serve it, nothing is injected into it. The security guard keeps its
  Host check on `/preview`, skips its token injection there (a page an agent wrote must never see
  the secret), and skips its Origin and Sec-Fetch-Site check, because a sandboxed page's own
  files arrive with `Origin: null` and `Sec-Fetch-Site: cross-site`; the ticket authorises them.
  `/api` stays refused for such a page (`forbidden-origin`, and no secret to send). A folder
  address serves its `index.html`.
- **Ticket.** `POST /api/sessions/:id/preview` (authenticated like the rest of the API) mints a
  192-bit random ticket for that one session; asking again gives the same ticket while it lives.
  Tickets live in memory only (an app restart ends them), expire an hour after their last use,
  and stop working when the session is archived (checked on every request). The route reads the
  session from the ticket, never from the URL, so one session's ticket cannot name another
  session's files. The SDK's `files.previewUrl(id, path)` adds a changing `?v=` to the address, so
  a reload is a new address.
- **Reads.** Bytes come from the relay's new `relay/fs.readBytes` (base64, working copy only,
  10 MiB cap, `fileTooLarge` above it), so images and fonts are not damaged. The relay refuses
  paths and symlinks that leave the worktree and any `.git` segment (in any letter case, since
  the Mac file system ignores case); the route also refuses `..`, `.`, empty segments,
  backslashes and NUL before asking. `/preview/<ticket>` without the slash redirects to it, so
  relative links resolve.
- **Headers on every response, errors included:**
  `Content-Security-Policy: sandbox allow-scripts allow-forms; default-src
  http://127.0.0.1:<port>/preview/<ticket>/ data: blob: 'unsafe-inline' 'unsafe-eval';
  connect-src 'none'; form-action 'none'; frame-ancestors 'self'`,
  `X-Content-Type-Options: nosniff`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  and, for scripts, styles and fonts requested from the sandbox, `Access-Control-Allow-Origin: *`
  (fonts and module scripts from an opaque origin are CORS requests).
  - `sandbox` without `allow-same-origin`: the page has an opaque origin, so it cannot read the
    app's storage or cookies, and its requests carry no credentials. The header makes this hold
    when the address is opened in its own tab too, not only in our iframe.
  - `default-src` names the ticket's own folder, not `'self'`: the page may load its sibling
    files, `data:` and `blob:`, but not `/api`, not the UI, not another ticket. Inline scripts,
    inline styles and `eval` are allowed because agent-made pages need them. The origin is the
    request's own, which the server's Host check has limited to the loopback address. `'self'` is
    never used: inside a sandbox it would mean the whole app. A response for an unknown ticket
    gets `default-src 'none'`.
  - `connect-src 'none'`: no `fetch`, XHR, WebSocket or beacon at all. Pages that load data from
    their own folder with `fetch` therefore do not work; scripts and images do.
  - `form-action 'none'`: a form cannot post to the API. `allow-forms` stays in the sandbox so
    forms driven by script work.
  - `frame-ancestors 'self'`: only the app can frame it.
- **Leaked addresses.** A sandbox cannot stop a page from navigating its own frame, so a hostile
  page could send its address (with the ticket) to another site. That site's script then could
  read files with `fetch`. The route therefore only answers requests whose `Sec-Fetch-Dest` is a
  way pages load their own files (document, iframe, script, style, image, font, media, worker),
  never `empty` (`fetch`, XHR) or a data import; it sends `Access-Control-Allow-Origin: *` only
  to a request with `Origin: null` and only for scripts, styles, fonts and wasm (modules and
  fonts need it), so no data file is readable cross-origin; and the relay refuses `.env*`,
  `.npmrc` and `.netrc`, by the requested name and by the real name behind a link (`leak.js ->
  .env`). Only these names are protected: files that a repo's `copyFiles` setting adds under other
  names are not. A hostile page can still leak its own scripts and styles this way. Tickets still end after an hour unused, on archive and on
  restart. Not covered: a browser too old to send `Sec-Fetch-Dest`; a symlink inside the
  worktree that points at a `.git` folder of a nested repository.
- **Iframe.** `sandbox="allow-scripts allow-forms"` for pages, the same flags as the header; never
  `allow-same-origin`, `allow-top-navigation` or `allow-popups`. Rendered Markdown has no scripts
  and gets `allow-popups allow-popups-to-escape-sandbox` only, so its links open in a new tab.
- **Refresh.** The UI re-asks for an address (a new `?v=`) after file changes inside the page's
  folder (250 ms pause) and on Reload. A page that uses files outside its folder (`../css/x.css`)
  is not refreshed by edits to them until Reload. The browser does not let the app read or keep the scroll
  position of a frame with an opaque origin, so a refresh starts at the top.

## Rejected

- Exempting `/preview` from authentication: a guessable route would let any local page read
  worktrees. The ticket is a capability instead.
- `allow-same-origin` in the sandbox: it would give the page the app's origin and API.
- Injecting a script into the page to keep scroll position or report errors: the app must add
  nothing to previewed documents.

## Consequences

- Another agent's guard must leave `/preview/*` alone and keep `/api/sessions/:id/preview`
  behind the token.
- A new transport (SSH workspaces) only needs `relay/fs.readBytes`; the route does not change.
