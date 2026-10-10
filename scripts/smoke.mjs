// Lightweight smoke test for hyperframes-mcp.
//
// Spawns the MCP server over stdio (node index.mjs), performs the MCP
// handshake, asks for tools/list and asserts that all expected tools are
// registered. No video is rendered and no browser is launched, so this runs
// fast and deterministically in CI.
//
// Usage: node scripts/smoke.mjs
// Exit code 0 = all expected tools present; 1 = mismatch, crash or timeout.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const EXPECTED_TOOLS = [
  "hyperframes_init",
  "hyperframes_info",
  "hyperframes_doctor",
  "hyperframes_lint",
  "hyperframes_check",
  "hyperframes_render",
  "hyperframes_preview",
  "hyperframes_add",
  "hyperframes_compositions",
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPath = join(__dirname, "..", "index.mjs");

const child = spawn(process.execPath, [serverPath], {
  cwd: join(__dirname, ".."),
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
});

let buf = "";
const pending = new Map();
let nextId = 1;
let stderrBuf = "";

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue; // ignore non-JSON noise on stdout
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg);
    }
  }
});

child.stderr.on("data", (d) => {
  stderrBuf += d.toString();
});

const globalTimer = setTimeout(() => {
  console.error("SMOKE FAIL: timed out waiting for the MCP server");
  child.kill();
  process.exit(1);
}, 20000);

function call(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

function notify(method, params) {
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

try {
  await call("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "hyperframes-smoke", version: "1.0.0" },
  });
  notify("notifications/initialized", {});

  const list = await call("tools/list", {});
  const tools = list.result.tools.map((t) => t.name);

  console.log("Discovered tools (" + tools.length + "):");
  for (const name of tools) console.log("  - " + name);

  const missing = EXPECTED_TOOLS.filter((n) => !tools.includes(n));
  const unexpected = tools.filter((n) => !EXPECTED_TOOLS.includes(n));

  if (missing.length || unexpected.length || tools.length !== EXPECTED_TOOLS.length) {
    if (missing.length) console.error("SMOKE FAIL: missing tools: " + missing.join(", "));
    if (unexpected.length) console.error("SMOKE FAIL: unexpected tools: " + unexpected.join(", "));
    if (tools.length !== EXPECTED_TOOLS.length)
      console.error("SMOKE FAIL: expected " + EXPECTED_TOOLS.length + " tools, got " + tools.length);
    clearTimeout(globalTimer);
    child.kill();
    process.exit(1);
  }

  console.log("SMOKE OK: all " + EXPECTED_TOOLS.length + " expected tools are registered.");
  clearTimeout(globalTimer);
  child.kill();
  process.exit(0);
} catch (err) {
  console.error("SMOKE FAIL: " + err.message);
  if (stderrBuf.trim()) console.error("server stderr:\n" + stderrBuf.trim());
  clearTimeout(globalTimer);
  child.kill();
  process.exit(1);
}
