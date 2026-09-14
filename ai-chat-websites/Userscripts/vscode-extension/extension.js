/**
 * VS Code Extension entry point for Unified AI Assistant Suite.
 * Commands: generate script, insert template, preview template.
 */

const vscode = require('vscode');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log('Unified AI Assistant Suite extension is now active');

  const generateCmd = vscode.commands.registerCommand('aisuite.generateScript', async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Describe the userscript to generate',
      placeHolder: 'e.g., A script that adds keyboard shortcuts to GitHub'
    });
    if (!prompt) return;

    const provider = vscode.workspace.getConfiguration('aisuite').get('provider') || 'auto';
    const temperature = vscode.workspace.getConfiguration('aisuite').get('temperature') || 0.7;

    // Placeholder: actual generation would call the background.js API
    vscode.window.showInformationMessage(
      `[${provider}] Generating script for: "${prompt.substring(0, 50)}..." (temp: ${temperature})`
    );
  });

  const insertCmd = vscode.commands.registerCommand('aisuite.insertTemplate', async () => {
    const templates = [
      'DOM Manipulation',
      'Keyboard Shortcuts',
      'CSS Override',
      'Fetch Interceptor',
      'UI Enhancement'
    ];
    const choice = await vscode.window.showQuickPick(templates, {
      placeHolder: 'Select a template to insert'
    });
    if (!choice) return;

    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('No active editor');
      return;
    }

    const snippet = `// ==UserScript==
// @name         ${choice}
// @namespace    https://github.com/eric847b
// @version      1.0.0
// @description  ${choice} template
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
  'use strict';
  // Template: ${choice}
})();
`;
    editor.insertSnippet(new vscode.SnippetString(snippet));
  });

  const previewCmd = vscode.commands.registerCommand('aisuite.previewTemplate', async () => {
    vscode.window.showInformationMessage('Template preview: open the AI Suite webview to see rendered output.');
  });

  context.subscriptions.push(generateCmd, insertCmd, previewCmd);
}

function deactivate() {}

module.exports = { activate, deactivate };
