// ==UserScript==
// @name         Accessibility Enhancer
// @namespace   AI-Chat-Userscript-Studio
// @version     1.0.0
// @description WCAG compliance checker and accessibility enhancement module
// @match       *://*/*
// @grant       none
// @run-at      document-idle
// ==/UserScript==

(function() {
    'use strict';

    const MODULE_ID = '40-accessibility-enhancer';
    const MODULE_VERSION = '1.0.0';

    class AccessibilityEnhancer {
        constructor() {
            this.violations = [];
            this.config = {
                checkContrast: true,
                checkAltText: true,
                checkHeadings: true,
                checkLabels: true,
                checkLandmarks: true,
                autoFixBasic: false
            };
            this.wcagStandards = {
                minContrastRatio: 4.5,
                minLargeTextContrast: 3.0,
                minTouchTarget: 44,
                maxLineLength: 80
            };
        }

        async init() {
            console.log(`[${MODULE_ID}] Initializing Accessibility Enhancer v${MODULE_VERSION}`);
            this.loadConfig();
            this.runAudit();
            this.injectEnhancements();
            this.observeChanges();
            return true;
        }

        loadConfig() {
            try {
                const stored = localStorage.getItem(`${MODULE_ID}-config`);
                if (stored) {
                    this.config = { ...this.config, ...JSON.parse(stored) };
                }
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to load config:`, e);
            }
        }

        saveConfig() {
            try {
                localStorage.setItem(`${MODULE_ID}-config`, JSON.stringify(this.config));
            } catch (e) {
                console.warn(`[${MODULE_ID}] Failed to save config:`, e);
            }
        }

        getContrastRatio(foreground, background) {
            const lum = (c) => {
                const rgb = c.match(/\w\w/g).map(x => parseInt(x, 16) / 255);
                const [r, g, b] = rgb;
                const [rs, gs, bs] = [r, g, b].map(c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
                return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
            };
            const ratio = (lum(fg) + 0.05) / (lum(bg) + 0.05);
            return Math.round(ratio * 100) / 100;
        }

        hexToRgb(hex) {
            if (!hex || !hex.startsWith('#')) return '#000000';
            return hex.slice(0, 7);
        }

        checkColorContrast(element) {
            const styles = window.getComputedStyle(element);
            const color = this.hexToRgb(styles.color);
            const bgColor = this.hexToRgb(styles.backgroundColor);

            if (color === bgColor) return null;

            const ratio = this.getContrastRatio(color, bgColor);
            const fontSize = parseFloat(styles.fontSize);
            const fontWeight = styles.fontWeight;
            const isLarge = fontSize >= 18 || (fontSize >= 14 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));
            const minRatio = isLarge ? this.wcagStandards.minLargeTextContrast : this.wcagStandards.minContrastRatio;

            if (ratio < minRatio) {
                return {
                    type: 'contrast',
                    severity: 'error',
                    element: element,
                    message: `Insufficient color contrast ratio: ${ratio}:1 (minimum: ${minRatio}:1)`,
                    ratio: ratio,
                    min: minRatio
                };
            }
            return null;
        }

        checkAltText(img) {
            if (!img.hasAttribute('alt')) {
                return {
                    type: 'alt-missing',
                    severity: 'error',
                    element: img,
                    message: 'Image missing alt attribute',
                    src: img.src
                };
            }
            if (img.alt.trim() === '' && !img.hasAttribute('role')) {
                return {
                    type: 'alt-empty',
                    severity: 'warning',
                    element: img,
                    message: 'Image has empty alt text - ensure it is decorative',
                    src: img.src
                };
            }
            return null;
        }

        checkHeadings() {
            const issues = [];
            const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            let previousLevel = 0;

            headings.forEach(h => {
                const level = parseInt(h.tagName[1]);
                if (level > previousLevel + 1 && previousLevel > 0) {
                    issues.push({
                        type: 'heading-skip',
                        severity: 'warning',
                        element: h,
                        message: `Heading level skipped: h${previousLevel} to h${level}`,
                        level: level
                    });
                }
                previousLevel = level;
            });

            if (!document.querySelector('h1')) {
                issues.push({
                    type: 'missing-h1',
                    severity: 'warning',
                    element: document.body,
                    message: 'No h1 heading found on page'
                });
            }

            return issues;
        }

        checkLabels(input) {
            const issues = [];
            const inputs = document.querySelectorAll('input, textarea, select');

            inputs.forEach(input => {
                const type = input.type;
                if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset') return;

                const hasLabel = input.labels && input.labels.length > 0;
                const hasAriaLabel = input.hasAttribute('aria-label');
                const hasAriaLabelledBy = input.hasAttribute('aria-labelledby');
                const hasTitle = input.hasAttribute('title');
                const isAvatar = input.hasAttribute('role');

                if (!hasLabel && !hasAriaLabel && !hasAriaLabelledBy && !hasTitle) {
                    issues.push({
                        type: 'missing-label',
                        severity: 'error',
                        element: input,
                        message: `Form input missing accessible label: ${input.type || input.tagName}`,
                        id: input.id || 'unnamed'
                    });
                }
            });

            return issues;
        }

        checkLandmarks() {
            const issues = [];
            const landmarks = ['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search'];
            const found = new Set();

            document.querySelectorAll('[role]').forEach(el => {
                if (landmarks.includes(el.getAttribute('role'))) {
                    found.add(el.getAttribute('role'));
                }
            });

            document.querySelectorAll('header, nav, main, aside, footer, [role="banner"], [role="navigation"], [role="main"]').forEach(el => {
                const role = el.tagName.toLowerCase();
                if (role === 'header') found.add('banner');
                if (role === 'nav') found.add('navigation');
                if (role === 'main') found.add('main');
                if (role === 'aside') found.add('complementary');
                if (role === 'footer') found.add('contentinfo');
            });

            if (!found.has('main')) {
                issues.push({
                    type: 'missing-main',
                    severity: 'warning',
                    element: document.body,
                    message: 'No main landmark found - add <main> or role="main"'
                });
            }

            return issues;
        }

        runAudit() {
            this.violations = [];

            // Check color contrast
            if (this.config.checkContrast) {
                document.querySelectorAll('body *').forEach(el => {
                    const issue = this.checkColorContrast(el);
                    if (issue) this.violations.push(issue);
                });
            }

            // Check alt text
            if (this.config.checkAltText) {
                document.querySelectorAll('img').forEach(img => {
                    const issue = this.checkAltText(img);
                    if (issue) this.violations.push(issue);
                });
            }

            // Check headings
            if (this.config.checkHeadings) {
                this.violations.push(...this.checkHeadings());
            }

            // Check labels
            if (this.config.checkLabels) {
                this.violations.push(...this.checkLabels());
            }

            // Check landmarks
            if (this.config.checkLandmarks) {
                this.violations.push(...this.checkLandmarks());
            }

            console.log(`[${MODULE_ID}] Audit complete. Found ${this.violations.length} issues.`);
            this.violations.forEach(v => {
                console.warn(`[${MODULE_ID}] ${v.severity.toUpperCase()}: ${v.message}`);
            });
        }

        injectEnhancements() {
            // Add skip link if missing
            if (!document.querySelector('a[href="#main"]')) {
                const skipLink = document.createElement('a');
                skipLink.href = '#main';
                skipLink.textContent = 'Skip to main content';
                skipLink.className = 'a11y-skip-link';
                skipLink.style.cssText = `
                    position: absolute;
                    top: -40px;
                    left: 0;
                    background: #000;
                    color: #fff;
                    padding: 8px;
                    z-index: 100000;
                    transition: top 0.2s;
                `;
                skipLink.addEventListener('focus', () => skipLink.style.top = '0');
                skipLink.addEventListener('blur', () => skipLink.style.top = '-40px');
                document.body.insertBefore(skipLink, document.body.firstChild);
            }

            // Add ARIA live region for dynamic content
            if (!document.querySelector('[aria-live]')) {
                const liveRegion = document.createElement('div');
                liveRegion.setAttribute('aria-live', 'polite');
                liveRegion.setAttribute('aria-atomic', 'true');
                liveRegion.className = 'a11y-live-region';
                liveRegion.style.cssText = 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0);';
                document.body.appendChild(liveRegion);
            }
        }

        observeChanges() {
            const observer = new MutationObserver(() => {
                this.runAudit();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }

        destroy() {
            console.log(`[${MODULE_ID}] Destroying Accessibility Enhancer`);
        }
    }

    const instance = new AccessibilityEnhancer();
    window[`${MODULE_ID}_instance`] = instance;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => instance.init());
    } else {
        instance.init();
    }
})();