#!/usr/bin/env node

const path = require("path");
const { spawnSync } = require("child_process");

const SUITE_DIR = path.resolve(__dirname, "..", "AI Chat Userscript Studio", "Userscript Suite");

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const [suiteCommand, ...forwardedArgs] = process.argv.slice(2);

if (!suiteCommand) {
  console.error("Usage: node ./tools/run-suite.cjs <npm-script-or-command> [-- extra args]");
  process.exit(1);
}

const passthroughCommands = new Set(["ci", "install"]);
const npmArgs = passthroughCommands.has(suiteCommand)
  ? [suiteCommand, ...forwardedArgs]
  : ["run", suiteCommand, ...(forwardedArgs.length > 0 ? ["--", ...forwardedArgs] : [])];

const runnerCommand = process.platform === "win32" ? process.env.ComSpec || "cmd.exe" : npmCommand;
const runnerArgs =
  process.platform === "win32" ? ["/d", "/s", "/c", npmCommand, ...npmArgs] : npmArgs;

const result = spawnSync(runnerCommand, runnerArgs, {
  cwd: SUITE_DIR,
  stdio: "inherit",
});

if (result.error) {
  console.error(`Failed to run npm command in ${SUITE_DIR}: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 0);
