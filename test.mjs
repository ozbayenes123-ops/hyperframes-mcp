import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const child = spawn(process.execPath, ["index.mjs"], { cwd: process.cwd() });
let buf = "";
const pending = new Map();
let nextId = 1;

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});
child.stderr.on("data", (d) => process.stderr.write("[srv] " + d));

function call(method, params) {
  const id = nextId++;
  return new Promise((res) => {
    pending.set(id, res);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}
async function tool(name, args, timeoutMs = 300000) {
  const t = setTimeout(() => { console.log(`!! TOOL TIMEOUT: ${name}`); child.kill(); process.exit(1); }, timeoutMs);
  const r = await call("tools/call", { name, arguments: args });
  clearTimeout(t);
  return r.result;
}

await call("initialize", { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" } });
await call("notifications/initialized", {});
const list = await call("tools/list", {});
console.log("TOOLS:", list.result.tools.map((t) => t.name).join(", "));

const tmp = mkdtempSync(join(tmpdir(), "hf-test-"));
const proj = join(tmp, "demo");

const initR = await tool("hyperframes_init", { name: "demo", cwd: tmp }, 300000);
console.log("--- INIT ---\nexit note:", initR.isError ? "ERROR" : "ok");
console.log(initR.content[0].text.slice(0, 600));

const checkR = await tool("hyperframes_check", { cwd: proj }, 120000);
console.log("--- CHECK ---\nisError:", checkR.isError);
console.log(checkR.content[0].text.slice(0, 800));

const renderR = await tool("hyperframes_render", { cwd: proj }, 300000);
console.log("--- RENDER ---\nisError:", renderR.isError);
console.log(renderR.content[0].text.slice(-1200));

child.kill();
process.exit(0);