#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { checkProse, renderReport, PASS_VERDICT, VERSION } from "./core.js";
import type { Kind } from "./types.js";

const KINDS: Kind[] = ["pr-body", "commit", "comment"];

function usage(): never {
  console.error(`Usage:
  prosecheck pr-body|commit|comment <file|-> [--json]
  prosecheck mcp
  prosecheck --version`);
  process.exit(2);
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v" || cmd === "version") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !KINDS.includes(cmd as Kind)) usage();
  const kind = cmd as Kind;
  const file = rest.find((a) => !a.startsWith("--"));
  if (!file) usage();
  let text: string;
  try {
    text = file === "-" ? await readStdin() : readFileSync(file, "utf8");
  } catch (e) {
    console.error(`error: could not read ${file}: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  const report = checkProse(kind, text, file);
  const out = rest.includes("--json") ? JSON.stringify(report, null, 2) : renderReport(report);
  process.stdout.write(out + "\n");
  process.exitCode = report.verdict === PASS_VERDICT ? 0 : 1;
}
void main();
