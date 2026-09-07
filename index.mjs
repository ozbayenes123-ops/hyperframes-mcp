import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("hyperframes/package.json");
const CLI_BIN = join(dirname(pkgPath), "bin", "hyperframes.mjs");

const DEFAULT_WORKSPACE = join(homedir(), "hyperframes");
mkdirSync(DEFAULT_WORKSPACE, { recursive: true });

function runCli(args, { cwd, timeoutMs = 120000 } = {}) {
  const target = resolve(cwd || DEFAULT_WORKSPACE);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_BIN, ...args], {
      cwd: target,
      windowsHide: true,
      env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" },
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);
    child.stdout.on("data", (b) => (stdout += b.toString()));
    child.stderr.on("data", (b) => (stderr += b.toString()));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    });
  });
}

function startPreview({ cwd }) {
  const target = resolve(cwd || DEFAULT_WORKSPACE);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [CLI_BIN, "preview"], {
      cwd: target,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HYPERFRAMES_SKIP_SKILLS: "1" },
    });
    let out = "";
    let settled = false;
    const urlRe = /https?:\/\/localhost:\d+/;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("No preview URL within 30s. Output:\n" + out));
    }, 30000);
    const onData = (buf) => {
      out += buf.toString();
      const m = out.match(urlRe);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolvePromise({ url: m[0], output: out, pid: child.pid });
      }
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
    child.on("exit", (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Preview exited (code ${code}) before URL appeared. Output:\n${out}`));
      }
    });
  });
}

function result(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

const server = new McpServer({ name: "hyperframes-mcp", version: "1.0.0" });

server.tool(
  "hyperframes_init",
  "Scaffold a new HyperFrames video project (HTML composition project) in the given directory. Use before any other work on a new video.",
  {
    name: z.string().describe("Project folder name"),
    cwd: z.string().optional().describe("Parent directory; defaults to ~/hyperframes"),
    example: z.string().optional().describe("Starter template: blank (default), video, audio, or a named example"),
  },
  async ({ name, cwd, example = "blank" }) => {
    const r = await runCli(["init", name, "--example", example], { cwd });
    const text = [`exit=${r.code}${r.timedOut ? " (timed out)" : ""}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim();
    return result(text || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_info",
  "Show HyperFrames CLI/system environment info (Node, FFmpeg, versions).",
  {},
  async () => {
    const r = await runCli(["info"], {});
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_doctor",
  "Run HyperFrames environment diagnostics (browser, ffmpeg, dependencies). Use when render or preview fails.",
  {},
  async () => {
    const r = await runCli(["doctor"], { timeoutMs: 180000 });
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_lint",
  "Validate a HyperFrames composition file / project for errors (data attributes, clips, tracks).",
  { cwd: z.string().optional().describe("Project directory (contains index.html)"), args: z.array(z.string()).optional().describe("Extra CLI arguments") },
  async ({ cwd, args = [] }) => {
    const r = await runCli(["lint", ...args], { cwd });
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_check",
  "Validate a full HyperFrames project structure and compositions.",
  { cwd: z.string().optional().describe("Project directory"), args: z.array(z.string()).optional().describe("Extra CLI arguments") },
  async ({ cwd, args = [] }) => {
    const r = await runCli(["check", ...args], { cwd });
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_render",
  "Render a HyperFrames composition to MP4 (headless Chrome + FFmpeg). Long-running; pass timeoutMs for big videos.",
  { cwd: z.string().optional().describe("Project directory (contains index.html)"), args: z.array(z.string()).optional().describe("Extra CLI arguments, e.g. --out result.mp4"), timeoutMs: z.number().optional().describe("Max wait in ms (default 600000)") },
  async ({ cwd, args = [], timeoutMs = 600000 }) => {
    const r = await runCli(["render", ...args], { cwd, timeoutMs });
    return result([`exit=${r.code}${r.timedOut ? " (timed out)" : ""}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_preview",
  "Start the HyperFrames preview server for a project in the background and return its localhost URL. The server keeps running until the session ends.",
  { cwd: z.string().optional().describe("Project directory") },
  async ({ cwd }) => {
    try {
      const p = await startPreview({ cwd });
      return result(`Preview running at ${p.url} (pid ${p.pid}).\n\n${p.output}`);
    } catch (e) {
      return result(`ERROR: ${e.message}`, true);
    }
  }
);

server.tool(
  "hyperframes_add",
  "Install a ready-made catalog block (e.g. data-chart, flash-through-white, instagram-follow) into a project.",
  { block: z.string().describe("Catalog block name"), cwd: z.string().optional().describe("Project directory"), args: z.array(z.string()).optional().describe("Extra CLI arguments") },
  async ({ block, cwd, args = [] }) => {
    const r = await runCli(["add", block, ...args], { cwd });
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

server.tool(
  "hyperframes_compositions",
  "List compositions found in a HyperFrames project.",
  { cwd: z.string().optional().describe("Project directory") },
  async ({ cwd }) => {
    const r = await runCli(["compositions"], { cwd });
    return result([`exit=${r.code}`, r.stdout, r.stderr].filter(Boolean).join("\n").trim() || "(no output)", r.code !== 0);
  }
);

await server.connect(new StdioServerTransport());