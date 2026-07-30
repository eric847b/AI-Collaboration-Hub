const fs = require("fs");

const files = [
  "AI Chat Websites\\Userscripts\\AI Chat Userscript Studio\\Userscript Suite\\00-hub.user.js",
  "AI Chat Websites\\Userscripts\\AI Chat Userscript Studio\\Userscript Suite\\Modules\\04-Production\\004-copilot-automation-guardian-roi-v163.module.user.js",
];

for (const file of files) {
  let code = fs.readFileSync(file, "utf8");

  // Remove all comments
  code = code.replace(/\/\*[\s\S]*?\*\//g, "");
  code = code.replace(/\/\/.*/g, "");

  // Remove blank lines
  const lines = code.split("\n").filter((l) => l.trim().length > 0);
  code = lines.join("\n");

  // Remove extra spaces around operators and punctuation
  code = code.replace(/\s*([=+\-*/!<>&|])\s*/g, "$1");
  code = code.replace(/\s*([{}();,:])\s*/g, "$1");
  code = code.replace(/([{}();,:])\s*/g, "$1");

  // Remove leading/trailing whitespace from each line
  const finalLines = code
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  code = finalLines.join("\n");

  fs.writeFileSync(file, code);
  console.log(`${file}: ${finalLines.length} lines`);
}
