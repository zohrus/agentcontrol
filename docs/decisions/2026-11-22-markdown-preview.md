# Markdown preview: marked (2026-11-22)

Author: preview agent. Part of the Preview tab (`docs/plan.html`, "Preview tab").

## Context

The Preview tab shows Markdown files only if a library passes the dependency bar in `AGENTS.md`:
known owner, release in the last 12 months, permissive license, few dependencies, released at
least 14 days ago (bunfig enforces it). Checked with `npm view` on 2026-11-22.

| | marked | markdown-it | micromark |
|---|---|---|---|
| Owner | markedjs organisation (4 maintainers) | one maintainer (vitaly) | one maintainer (wooorm, unified collective) |
| Latest release | 18.2.1, 2026-11-16 (weekly releases) | 15.0.3, 2026-10-16 | 4.0.3, 2026-09-26 |
| License | MIT | MIT | MIT |
| Dependencies | 0 | 6 | 17 (plus `micromark-extension-gfm`, 8 more, for tables and task lists) |
| Unpacked size | 0.6 MB | 2.1 MB | 0.2 MB + the GFM extension |
| Tables, task lists, fenced code | built in (`gfm: true`) | tables built in; task lists need a plugin | tables and task lists need the extension |
| Output | HTML string | HTML string | HTML string |

## Decision

Use `marked`, pinned to **18.1.3** (released 2026-11-02; 18.2.0 and 18.2.1 are younger than 14
days). It passes every point of the bar, has no dependencies, and does GitHub-flavoured tables,
task lists and fenced code with no plugin.

Also added as a direct dependency of `packages/ui-template`: **`dompurify` 3.4.17**, the version
the root `overrides` already pins (it was in the tree only through Monaco, and knip rejects an
import of a package that is not declared). Cure53, Apache-2.0 or MPL-2.0, one type-only
dependency.

Markdown is turned into HTML in the browser, sanitised with DOMPurify (scripts, event handlers,
`style`, `form`, `svg`, `math`, `base` and `meta` are removed; links get
`target=_blank rel="noopener noreferrer"`, except links to a section of the same file),
and shown in the same sandboxed `iframe` component as HTML pages, through `srcdoc`. Markdown
documents get a stricter sandbox than pages (`allow-popups allow-popups-to-escape-sandbox` only:
no scripts at all) and their own policy in a `<meta>` tag (`default-src 'none'`, images only from
`/preview/` and `data:`). Relative images and links are rewritten to the file's folder in the preview
route (no `<base>` tag, which would turn every `#section` link into a trip to that folder), and
images carry the load number so a refresh fetches them again.

## Rejected

- `markdown-it`: passes the bar but needs a plugin for task lists, has six dependencies and one
  maintainer.
- `micromark`: needs the GFM extension, which has not been released since 2023-06, and brings
  17 plus 8 dependencies.

## Consequences

- Two new runtime dependencies in `packages/ui-template`, both pinned exactly.
- Revisit `marked` when 18.2.x is older than 14 days; bump with `ALLOW_DEP_CHANGE=1`.
- The root `overrides` entry for `dompurify` stays (it also covers Monaco).
