const BY_EXTENSION = new Map(
  Object.entries({
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    map: "application/json; charset=utf-8",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif",
    ico: "image/x-icon",
    woff: "font/woff",
    woff2: "font/woff2",
    ttf: "font/ttf",
    otf: "font/otf",
    wasm: "application/wasm",
    txt: "text/plain; charset=utf-8",
    md: "text/plain; charset=utf-8",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    webm: "video/webm",
  }),
);

/** The content type for a file name; anything unknown is opaque bytes, which `nosniff` keeps inert. */
export function contentTypeOf(path: string): string {
  const extension = /\.([^./]+)$/.exec(path)?.[1]?.toLowerCase() ?? "";
  return BY_EXTENSION.get(extension) ?? "application/octet-stream";
}
