// ==UserScript==
// @name         Clipboard Utility
// @namespace    https://ai-rmd.github.io/
// @version      1.0.0
// @description  Enhanced clipboard functionality for AI chat platforms
// @author       AI RMD
// @match        *://chat.openai.com/*
// @match        *://www.typingmind.com/*
// @match        *://*.bing.com/chat*
// @match        *://*.google.com/chat*
// @grant        GM_setClipboard
// @grant        GM_notification
// @require      https://code.jquery.com/jquery-3.7.1.min.js
// @require      https://cdn.jsdelivr.net/npm/lodash@latest/lodash.min.js
// ==/UserScript==

(function() {
    'use strict';

    // Utility class for clipboard operations
    class ClipboardUtility {
        constructor() {
            this.init();
        }

        init() {
            // Add context menu items
            this.addContextMenuItems();
            // Add keyboard shortcuts
            this.addKeyboardShortcuts();
            // Add toolbar buttons
            this.addToolbarButtons();
        }

        // Add context menu items for enhanced clipboard operations
        addContextMenuItems() {
            document.addEventListener('contextmenu', (e) => {
                const menu = document.createElement('div');
                menu.style.cssText = `
                    position: absolute;
                    background: #fff;
                    border: 1px solid #ddd;
                    padding: 5px 0;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                    z-index: 10000;
                `;

                const items = [
                    { text: 'Copy as Markdown', action: () => this.copyAsMarkdown() },
                    { text: 'Copy as Plain Text', action: () => this.copyAsPlainText() },
                    { text: 'Copy with Timestamp', action: () => this.copyWithTimestamp() },
                    { text: 'Copy to New Tab', action: () => this.copyToNewTab() }
                ];

                items.forEach(item => {
                    const div = document.createElement('div');
                    div.style.cssText = 'padding: 5px 10px; cursor: pointer;';
                    div.textContent = item.text;
                    div.addEventListener('click', () => {
                        item.action();
                        menu.remove();
                    });
                    menu.appendChild(div);
                });

                menu.style.left = e.pageX + 'px';
                menu.style.top = e.pageY + 'px';
                document.body.appendChild(menu);
            });
        }

        // Add keyboard shortcuts for clipboard operations
        addKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.shiftKey) {
                    switch (e.key) {
                        case 'm':
                            e.preventDefault();
                            this.copyAsMarkdown();
                            break;
                        case 't':
                            e.preventDefault();
                            this.copyWithTimestamp();
                            break;
                        case 'n':
                            e.preventDefault();
                            this.copyToNewTab();
                            break;
                    }
                }
            });
        }

        // Add toolbar buttons for quick access
        addToolbarButtons() {
            const toolbar = document.querySelector('.toolbar') || document.querySelector('.header') || document.body;
            if (toolbar) {
                const container = document.createElement('div');
                container.style.cssText = 'display: flex; gap: 5px; margin-left: 10px;';

                const buttons = [
                    { title: 'Copy as Markdown', icon: '📝', action: () => this.copyAsMarkdown() },
                    { title: 'Copy with Timestamp', icon: '⏰', action: () => this.copyWithTimestamp() },
                    { title: 'Copy to New Tab', icon: '🔗', action: () => this.copyToNewTab() }
                ];

                buttons.forEach(btn => {
                    const button = document.createElement('button');
                    button.style.cssText = `
                        background: #007bff;
                        color: white;
                        border: none;
                        padding: 5px 10px;
                        border-radius: 3px;
                        cursor: pointer;
                        font-size: 14px;
                    `;
                    button.title = btn.title;
                    button.textContent = btn.icon;
                    button.addEventListener('click', btn.action);
                    container.appendChild(button);
                });

                toolbar.appendChild(container);
            }
        }

        // Copy selected text as Markdown
        copyAsMarkdown() {
            const selection = window.getSelection().toString();
            if (selection) {
                const markdown = this.convertToMarkdown(selection);
                GM_setClipboard(markdown);
                this.showNotification('Copied as Markdown');
            }
        }

        // Copy selected text as plain text
        copyAsPlainText() {
            const selection = window.getSelection().toString();
            if (selection) {
                GM_setClipboard(selection);
                this.showNotification('Copied as Plain Text');
            }
        }

        // Copy selected text with timestamp
        copyWithTimestamp() {
            const selection = window.getSelection().toString();
            if (selection) {
                const timestamp = new Date().toISOString();
                const text = `${timestamp}\n\n${selection}`;
                GM_setClipboard(text);
                this.showNotification('Copied with Timestamp');
            }
        }

        // Copy selected text to new tab
        copyToNewTab() {
            const selection = window.getSelection().toString();
            if (selection) {
                const encoded = encodeURIComponent(selection);
                const url = `data:text/plain;charset=UTF-8,${encoded}`;
                window.open(url, '_blank');
                this.showNotification('Opened in New Tab');
            }
        }

        // Convert text to Markdown format
        convertToMarkdown(text) {
            return text
                .replace(/^#+\s+(.*)$/gm, '## $1') // Convert headers
                .replace(/`([^`]+)`/g, '**`$1`**') // Convert inline code
                .replace(/\*([^\*]+)\*/g, '**$1**') // Convert bold
                .replace(/_([^_]+)_/g, '*$1*') // Convert italic
                .replace(/~~([^~]+)~~/g, '~~$1~~'); // Convert strikethrough
        }

        // Show notification
        showNotification(message) {
            GM_notification({
                text: message,
                title: 'Clipboard Utility',
                timeout: 2000
            });
        }
    }

    // Initialize the clipboard utility when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new ClipboardUtility());
    } else {
        new ClipboardUtility();
    }
})();