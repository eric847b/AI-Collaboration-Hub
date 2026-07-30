const fs = require("fs");
const path = require("path");

const base =
  "c:\\Users\\Eric\\OneDrive\\Documents\\Userscripts\\Userscripts\\AI Chat Userscript Studio\\Userscript Suite";

// Check response contract in HTML
const html = fs.readFileSync(path.join(base, "Hub Control Panel.html"), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  try {
    new Function(scriptMatch[1]);
    console.log("OK: Hub Control Panel inline script parses cleanly.");
  } catch (e) {
    console.log("ERROR: Hub Control Panel inline script parse fails:", e.message);
  }
} else {
  console.log("WARN: No inline script found in Hub Control Panel.");
}

// Check modules with data-temp pattern (Codex was going to roll back)
const filesToCheck = [
  "Modules/23-resource-optimizer.module.user.js",
  "Modules/26-intelligent-error-handler.module.user.js",
];
for (const f of filesToCheck) {
  const content = fs.readFileSync(path.join(base, f), "utf8");
  if (content.includes("el.dataset?.temp")) {
    console.log(`CHANGED: ${f} now uses dataset.temp filter`);
  } else if (content.includes("querySelectorAll")) {
    console.log(`ORIGINAL: ${f} still uses querySelectorAll`);
  }
}

// Check naming issues - files with spaces or special chars
const modulesDir = path.join(base, "Modules");
const files = fs.readdirSync(modulesDir);
const nameIssues = files.filter((f) => f.includes(" ") || f.includes("(") || f.includes(")"));
console.log("\nFiles with naming issues (spaces/parens):");
for (const f of nameIssues) {
  console.log(`  ${f}`);
}
