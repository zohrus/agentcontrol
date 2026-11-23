/** Why a request is refused before the secret is even looked at. */
export interface Refusal {
  status: 403;
  code: "forbidden-host" | "forbidden-origin";
  message: string;
}

const LOOPBACK_NAMES = ["127.0.0.1", "localhost", "[::1]"];
const SAME_SITE_VALUES = new Set(["same-origin", "none"]);

const hostsFor = (port: number): string[] =>
  LOOPBACK_NAMES.map((name) => `${name}:${String(port)}`);

function isOwnHost(options: { host: string | null; port: number }): boolean {
  if (options.host === null) return false;
  return hostsFor(options.port).includes(options.host.toLowerCase());
}

function isOwnOrigin(options: { origin: string; port: number }): boolean {
  return hostsFor(options.port).some((host) => `http://${host}` === options.origin);
}

function isOtherSite(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  return site !== null && !SAME_SITE_VALUES.has(site.toLowerCase());
}

function refusedOrigin(options: { headers: Headers; port: number; linkable: boolean }): boolean {
  const { headers, port, linkable } = options;
  const origin = headers.get("origin");
  if (origin !== null && !isOwnOrigin({ origin, port })) return true;
  const navigates = linkable && headers.get("sec-fetch-mode") === "navigate";
  return !navigates && isOtherSite(headers);
}

/**
 * The Host check (stops DNS rebinding) and the Origin check (stops other websites). Both name
 * only this app's own address on the port it really listens on. A missing Origin is fine here:
 * programs and some navigations send none, and they still need the secret.
 */
export function refusalFor(options: {
  headers: Headers;
  port: number;
  /** A read of a page outside `/api`: a link on another site may open it (the page stays unreadable there). */
  linkable: boolean;
  /** Skip the Origin check: the route is authorised some other way (a preview's ticket). */
  fromAnySite: boolean;
}): Refusal | undefined {
  const { headers, port } = options;
  if (!isOwnHost({ host: headers.get("host"), port })) {
    return {
      status: 403,
      code: "forbidden-host",
      message: "This address is not the app's own. Open it at http://127.0.0.1 or localhost.",
    };
  }
  if (!options.fromAnySite && refusedOrigin(options)) {
    return {
      status: 403,
      code: "forbidden-origin",
      message: "Requests from other websites are not allowed.",
    };
  }
  return undefined;
}
