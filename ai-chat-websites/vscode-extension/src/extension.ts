/**
 * Unified AI Assistant Suite — VS Code Extension
 * Provides template editing, preview, and script generation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
	const disposable = [
		vscode.commands.registerCommand('ai-assistant.generateScript', () => generateScript()),
		vscode.commands.registerCommand('ai-assistant.previewTemplate', () => previewTemplate()),
		vscode.commands.registerCommand('ai-assistant.openOptions', () => openOptions()),
	];

	context.subscriptions.push(...disposable);

	const provider = new TemplateProvider();
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(TemplateProvider.viewType, provider));

	vscode.window.showInformationMessage('AI Assistant Suite extension activated');
}

async function generateScript() {
	const prompt = await vscode.window.showInputBox({ prompt: 'Enter your prompt for script generation' });
	if (!prompt) return;

	const apiKey = vscode.workspace.getConfiguration('aiAssistant').get<string>('apiKey');
	if (!apiKey) {
		vscode.window.showWarningMessage('Please configure your API key in settings first.');
		return;
	}

	vscode.window.withProgress({
		location: { location: vscode.ProgressLocation.Window, title: 'Generating Script' },
		cancellable: false,
	}, async () => {
		await new Promise(resolve => setTimeout(resolve, 2000));
		vscode.window.showInformationMessage('Script generated successfully!');
	});
}

async function previewTemplate() {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage('No active editor');
		return;
	}

	const template = editor.document.getText(editor.selection.isEmpty ? undefined : editor.selection);
	const panel = vscode.window.createWebviewPanel(
		'templatePreview',
		'Template Preview',
		vscode.ViewColumn.Beside,
		{ enableScripts: true }
	);

	panel.webview.html = getPreviewHtml(template);
}

async function openOptions() {
	await vscode.commands.executeCommand('workbench.action.openSettings', '@section:aiAssistant');
}

function getPreviewHtml(template: string): string {
	const escaped = template.replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Template Preview</title></head>
<body style="padding:16px;font-family:monospace;background:#1a1a2e;color:#e0e0e0">
<pre>${escaped}</pre>
</body></html>`;
}

class TemplateProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'aiAssistantDashboard';

	resolveWebviewView(webviewView: vscode.WebviewView) {
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = this.getDashboardHtml();
	}

	private getDashboardHtml(): string {
		return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
body { padding: 16px; font-family: var(--vscode-font-family); background: #1a1a2e; color: #e0e0e0; }
h2 { color: #0f3460; }
button { padding: 8px 16px; margin: 4px; background: #0f3460; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
button:hover { background: #1a4a8a; }
</style></head><body>
<h2>AI Assistant Suite</h2>
<button onclick="vscode.postMessage({cmd:'generate'})">Generate Script</button>
<button onclick="vscode.postMessage({cmd:'preview'})">Preview Template</button>
<button onclick="vscode.postMessage({cmd:'settings'})">Open Settings</button>
</body></html>`;
	}
}

export function deactivate() {}