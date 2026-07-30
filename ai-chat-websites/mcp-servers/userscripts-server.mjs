#!/usr/bin/env node
/**
 * Userscripts Project MCP Server
 * Provides tools for project automation, validation, and management.
 * 
 * Tools:
 *   - validate-project: Run project validation
 *   - run-tests: Execute test suite
 *   - run-security-audit: Scan for security issues
 *   - check-git-status: Check git repository state
 *   - consolidate-duplicates: Find and remove duplicate userscripts
 *   - run-autonomous-check: Run full autonomous check suite
 */

import { spawnSync, execSync } from "child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ==================== MCP Protocol Implementation ====================

class McpServer {
  constructor() {
    this.tools = new Map();
    this.setupTools();
  }

  setupTools() {
    this.registerTool("validate-project", {
      description: "Validate project structure - checks userscripts are in correct locations and have proper headers",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const result = this.runScript("scripts/validate.cjs");
        return {
          content: [{ type: "text", text: result.success ? "✅ Validation passed" : `❌ Validation failed:\n${result.stderr}` }],
          isError: !result.success,
        };
      },
    });

    this.registerTool("run-tests", {
      description: "Run the project test suite",
      inputSchema: {
        type: "object",
        properties: {
          quick: {
            type: "boolean",
            description: "Run only quick tests (skip nested suite)",
            default: false,
          },
        },
        required: [],
      },
      handler: async (args) => {
        const results = [];
        
        // Root tests
        const rootTest = this.runScript("npm", ["test"]);
        results.push(`Root tests: ${rootTest.success ? "✅ Passed" : "❌ Failed"}`);
        
        if (!args?.quick) {
          // Nested suite tests
          const suiteTest = this.runScript("npm", ["run", "--prefix", "Userscripts", "test"]);
          results.push(`Userscripts tests: ${suiteTest.success ? "✅ Passed" : "❌ Failed"}`);
        }

        return {
          content: [{ type: "text", text: results.join("\n") }],
          isError: results.some(r => r.includes("❌")),
        };
      },
    });

    this.registerTool("run-security-audit", {
      description: "Run security audit to scan for vulnerable patterns and missing grants",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const result = this.runScript("node", ["scripts/security-audit.cjs"]);
        return {
          content: [{ type: "text", text: result.success ? "✅ Security audit passed" : `⚠ Security audit found issues:\n${result.stdout}\n${result.stderr}` }],
          isError: !result.success,
        };
      },
    });

    this.registerTool("check-git-status", {
      description: "Check git repository status - uncommitted changes, branch, recent commits",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
      handler: async () => {
        const info = [];
        
        try {
          const branch = execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
          info.push(`Branch: ${branch}`);
        } catch {
          info.push("Branch: N/A (not a git repo)");
        }

        try {
          const status = execSync("git status --porcelain", { cwd: ROOT, encoding: "utf8" });
          const changes = status.split("\n").filter(Boolean).length;
          info.push(`Uncommitted changes: ${changes}`);
          if (changes > 0) {
            info.push("\nFiles:");
            status.split("\n").filter(Boolean).forEach(line => info.push(`  ${line}`));
          }
        } catch {
          info.push("Git status: N/A");
        }

        try {
          const lastCommit = execSync("git log -1 --format='%h %s (%ar)'", { cwd: ROOT, encoding: "utf8" }).trim();
          info.push(`\nLast commit: ${lastCommit}`);
        } catch {
          // ignore
        }

        return {
          content: [{ type: "text", text: info.join("\n") }],
          isError: false,
        };
      },
    });

    this.registerTool("consolidate-duplicates", {
      description: "Find and optionally remove duplicate userscripts",
      inputSchema: {
        type: "object",
        properties: {
          dryRun: {
            type: "boolean",
            description: "Preview changes without deleting files",
            default: true,
          },
        },
        required: [],
      },
      handler: async (args) => {
        const dryRun = args?.dryRun !== false;
        const result = this.runScript("node", [
          "scripts/consolidate-all.cjs",
          ...(dryRun ? ["--dry-run"] : []),
        ]);
        return {
          content: [{ type: "text", text: result.stdout || (result.success ? "No duplicates found" : `Error: ${result.stderr}`) }],
          isError: !result.success,
        };
      },
    });

    this.registerTool("run-autonomous-check", {
      description: "Run the full autonomous check suite (validate, test, lint, security audit)",
      inputSchema: {
        type: "object",
        properties: {
          quick: {
            type: "boolean",
            description: "Skip security audit and nested suite checks",
            default: false,
          },
          fix: {
            type: "boolean",
            description: "Attempt to auto-fix issues",
            default: false,
          },
        },
        required: [],
      },
      handler: async (args) => {
        const cmdArgs = ["scripts/autonomous-check.cjs"];
        if (args?.quick) cmdArgs.push("--quick");
        if (args?.fix) cmdArgs.push("--fix");
        
        const result = this.runScript("node", cmdArgs);
        return {
          content: [{ type: "text", text: result.stdout || result.stderr || "Check completed" }],
          isError: !result.success,
        };
      },
    });
  }

  registerTool(name, tool) {
    this.tools.set(name, tool);
  }

  runScript(command, args = []) {
    const isNodeScript = command.endsWith(".cjs") || command.endsWith(".mjs") || command.endsWith(".js");
    const cmd = isNodeScript ? "node" : command;
    const cmdArgs = isNodeScript ? [command, ...args] : args;

    try {
      const result = spawnSync(cmd, cmdArgs, {
        cwd: ROOT,
        shell: process.platform === "win32",
        encoding: "utf8",
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        success: (result.status ?? 1) === 0,
        stdout: result.stdout || "",
        stderr: result.stderr || "",
        status: result.status,
      };
    } catch (error) {
      return {
        success: false,
        stdout: "",
        stderr: error.message,
        status: -1,
      };
    }
  }

  async handleMessage(message) {
    if (message.method === "tools/list") {
      return {
        tools: Array.from(this.tools.entries()).map(([name, tool]) => ({
          name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    }

    if (message.method === "tools/call") {
      const tool = this.tools.get(message.params.name);
      if (!tool) {
        return {
          content: [{ type: "text", text: `Unknown tool: ${message.params.name}` }],
          isError: true,
        };
      }

      try {
        return await tool.handler(message.params.arguments || {});
      } catch (error) {
        return {
          content: [{ type: "text", text: `Error executing ${message.params.name}: ${error.message}` }],
          isError: true,
        };
      }
    }

    if (message.method === "initialize") {
      return {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "userscripts-mcp-server",
          version: "1.0.0",
        },
      };
    }

    return null;
  }

  async start() {
    process.stdin.setEncoding("utf8");
    let buffer = "";

    process.stdin.on("data", async (chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const message = JSON.parse(line);
          const response = await this.handleMessage(message);

          if (response) {
            const responseMessage = {
              jsonrpc: "2.0",
              id: message.id,
              ...response,
            };
            process.stdout.write(JSON.stringify(responseMessage) + "\n");
          }
        } catch (error) {
          // Skip malformed JSON
        }
      }
    });

    process.stdin.on("end", () => {
      process.exit(0);
    });
  }
}

// Start the server
const server = new McpServer();
server.start().catch(console.error);