import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { checkProse, VERSION } from "./core.js";

const server = new McpServer({ name: "prosecheck", version: VERSION });
server.tool(
  "check_prose",
  "Check PR body, commit message, or reviewer reply prose against the prose gate: length limits, test-report dumps, headings/bullets, boilerplate. Returns PASS/FAIL with findings.",
  {
    kind: z.enum(["pr-body", "commit", "comment"]).describe("Which prose kind to check"),
    text: z.string().describe("The prose text to check"),
  },
  async ({ kind, text }) => {
    const report = checkProse(kind, text, "mcp");
    return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
  },
);
async function main(): Promise<void> { await server.connect(new StdioServerTransport()); }
void main();
