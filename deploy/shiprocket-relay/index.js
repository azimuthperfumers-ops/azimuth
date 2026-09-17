// ─────────────────────────────────────────────────────────────────────────────
// Shiprocket egress relay (Cloudflare Worker).
//
// Shiprocket's load balancer rejects our VPS IP (HTTP 403 from awselb before the
// API is reached). The server points SHIPROCKET_BASE_URL at this Worker, which
// forwards the call to apiv2.shiprocket.in from Cloudflare's network instead.
//
// Locked to our server by a shared secret header (RELAY_KEY, set with
// `wrangler secret put RELAY_KEY`) and to Shiprocket's /v1/external/ API only —
// it is not an open proxy. Nothing is logged: requests carry auth tokens and
// customer PII.
//
// Remove SHIPROCKET_BASE_URL from the server env to go direct again.
// ─────────────────────────────────────────────────────────────────────────────

const UPSTREAM = "https://apiv2.shiprocket.in";
const ALLOWED_PREFIX = "/v1/external/";
const FORWARD_HEADERS = ["authorization", "content-type", "accept"];

function keyOk(given, expected) {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (!keyOk(request.headers.get("x-relay-key"), env.RELAY_KEY)) {
      return new Response("forbidden", { status: 403 });
    }

    const url = new URL(request.url);
    if (!url.pathname.startsWith(ALLOWED_PREFIX)) {
      return new Response("not found", { status: 404 });
    }

    const headers = new Headers();
    for (const name of FORWARD_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }

    const hasBody = request.method !== "GET" && request.method !== "HEAD";
    const upstream = await fetch(UPSTREAM + url.pathname + url.search, {
      method: request.method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: "manual",
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        "x-relay-upstream-server": upstream.headers.get("server") ?? "",
      },
    });
  },
};
