#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Local-only editor for the VPS's .env.production.
//
//   pnpm env:edit                        (or: node deploy/env-editor/server.mjs)
//   VPS_HOST=1.2.3.4 pnpm env:edit       (point at a different box)
//
// Runs on your laptop, bound to 127.0.0.1, and reaches the VPS over your own SSH
// key — nothing new listens on the server. Every save keeps a timestamped backup
// next to the file (last 10), and refuses to overwrite if the file changed on
// the VPS since you loaded it. Containers only see new values after "Apply".
// ─────────────────────────────────────────────────────────────────────────────
import { createServer } from "node:http";
import { spawn, execFile } from "node:child_process";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";

const VPS_HOST = process.env.VPS_HOST ?? "201.18.193.55";
const VPS_USER = process.env.VPS_USER ?? "root";
const PORT = Number(process.env.PORT ?? 4477);
const DIR = "/opt/azimuth/deploy";
const FILE = `${DIR}/.env.production`;
const COMPOSE = "docker compose --env-file .env.production -f docker-compose.prod.yml";
const TOKEN = randomBytes(24).toString("hex");
const HTML = new URL("./index.html", import.meta.url);

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const KV_RE = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

// ── ssh ─────────────────────────────────────────────────────────────────────
function ssh(script, stdin = "") {
  return new Promise((resolve) => {
    const p = spawn("ssh", [
      "-o", "BatchMode=yes",
      "-o", "ConnectTimeout=10",
      `${VPS_USER}@${VPS_HOST}`,
      script,
    ]);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", (e) => resolve({ code: -1, out, err: e.message }));
    p.on("close", (code) => resolve({ code, out, err }));
    p.stdin.end(stdin);
  });
}

// ── .env <-> lines ──────────────────────────────────────────────────────────
// Comments and blank lines are kept as { raw } so a save never reorders or
// drops anything the editor doesn't understand.
function parse(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((l) => {
    const m = l.match(KV_RE);
    return m ? { key: m[1], value: m[2] } : { raw: l };
  });
}

function serialize(lines) {
  return lines.map((l) => ("key" in l ? `${l.key}=${l.value}` : l.raw)).join("\n") + "\n";
}

function validate(lines) {
  if (!Array.isArray(lines)) return "lines must be an array";
  for (const l of lines) {
    if (l && typeof l.raw === "string") {
      if (/[\r\n]/.test(l.raw)) return "comment lines cannot contain newlines";
    } else if (l && typeof l.key === "string" && typeof l.value === "string") {
      if (!KEY_RE.test(l.key)) return `invalid key "${l.key}"`;
      if (/[\r\n]/.test(l.value)) return `value for ${l.key} cannot contain newlines`;
    } else {
      return "malformed line";
    }
  }
  return null;
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

// ── handlers ────────────────────────────────────────────────────────────────
async function readEnv() {
  const r = await ssh(`cat ${FILE}`);
  if (r.code !== 0) throw httpError(502, `ssh read failed: ${r.err.trim() || r.code}`);
  return { host: VPS_HOST, file: FILE, sha: sha256(r.out), lines: parse(r.out) };
}

async function writeEnv({ sha, lines }) {
  if (typeof sha !== "string" || !/^[0-9a-f]{64}$/.test(sha)) throw httpError(400, "missing sha");
  const bad = validate(lines);
  if (bad) throw httpError(400, bad);

  const script = [
    "set -e",
    `F=${FILE}`,
    `[ "$(sha256sum "$F" | cut -d' ' -f1)" = "${sha}" ] || { echo CONFLICT >&2; exit 9; }`,
    `cp -p "$F" "$F.bak-$(date +%Y%m%d-%H%M%S)"`,
    `cat > "$F.tmp"`,
    `chown deploy:deploy "$F.tmp"`,
    `chmod 600 "$F.tmp"`,
    `mv "$F.tmp" "$F"`,
    `ls -1t "$F".bak-* | tail -n +11 | xargs -r rm --`,
  ].join("; ");

  const r = await ssh(script, serialize(lines));
  if (r.code === 9) throw httpError(409, "The file changed on the VPS since you loaded it. Reload and redo your edit.");
  if (r.code !== 0) throw httpError(502, `ssh write failed: ${r.err.trim() || r.code}`);
  return readEnv();
}

// Recreate server + worker so they pick up the new env. Pins IMAGE_TAG to what
// is already running — otherwise compose would fall back to IMAGE_TAG from the
// env file and could silently roll the image to a different build.
async function apply() {
  const script = [
    "set -e",
    `cd ${DIR}`,
    `export IMAGE_TAG="$(docker inspect -f '{{.Config.Image}}' azimuth-server-1 | sed 's/.*://')"`,
    `echo "image tag: $IMAGE_TAG"`,
    `${COMPOSE} up -d --no-deps server worker 2>&1`,
    `${COMPOSE} ps server worker`,
  ].join("; ");
  const r = await ssh(script);
  if (r.code !== 0) throw httpError(502, `apply failed:\n${r.out}${r.err}`);
  return { output: r.out + r.err };
}

// ── http ────────────────────────────────────────────────────────────────────
function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function tokenOk(given) {
  const a = Buffer.from(String(given ?? ""));
  const b = Buffer.from(TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw httpError(413, "body too large");
  }
  try {
    return JSON.parse(body || "{}");
  } catch {
    throw httpError(400, "invalid json");
  }
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

const server = createServer(async (req, res) => {
  try {
    // Only answer to our own origin (blocks DNS-rebinding from other sites).
    const host = req.headers.host ?? "";
    if (host !== `127.0.0.1:${PORT}` && host !== `localhost:${PORT}`) throw httpError(403, "bad host");

    const url = new URL(req.url, `http://${host}`);

    if (req.method === "GET" && url.pathname === "/") {
      if (!tokenOk(url.searchParams.get("t"))) throw httpError(403, "open the URL printed in the terminal");
      return send(res, 200, await readFile(HTML, "utf8"), "text/html; charset=utf-8");
    }

    // API calls need the token in a custom header, which a cross-site page
    // can't send without a CORS preflight we never approve.
    if (!tokenOk(req.headers["x-token"])) throw httpError(403, "bad token");

    if (req.method === "GET" && url.pathname === "/api/env") return send(res, 200, await readEnv());
    if (req.method === "POST" && url.pathname === "/api/env") return send(res, 200, await writeEnv(await readJson(req)));
    if (req.method === "POST" && url.pathname === "/api/apply") return send(res, 200, await apply());

    throw httpError(404, "not found");
  } catch (e) {
    send(res, e.status ?? 500, { error: e.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  const link = `http://127.0.0.1:${PORT}/?t=${TOKEN}`;
  console.log(`env editor for ${VPS_USER}@${VPS_HOST}:${FILE}`);
  console.log(`open: ${link}`);
  if (!process.env.NO_OPEN) execFile("xdg-open", [link], () => {});
});
