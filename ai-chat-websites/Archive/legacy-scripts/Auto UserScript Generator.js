  // ==UserScript==
  // @name         Auto UserScript Generator - AI RMD
  // @namespace    http://tampermonkey.net/
  // @version      0.7
  // @description  Observes user actions and generates userscripts to simplify tasks
  // @match        *://*/*
  // @grant        GM_setValue
  // @grant        GM_getValue
  // @grant        GM_registerMenuCommand
  // @grant        GM_notification
  // @grant        GM_setClipboard
  // ==/UserScript==

  (function() {
      'use strict';

      let actions = [];
      let isObserving = false;
      const MAX_ACTIONS = 500;
      const OBSERVATION_TIME = 900000; // 15 minutes

      function recordAction(action) {
          if (isObserving) {
              actions.push(action);
              if (actions.length > MAX_ACTIONS) {
                  actions.shift();
              }
          }
      }

      function observeClicks() {
          document.addEventListener('click', function(e) {
              if (e.target instanceof Element) {
                  recordAction({
                      type: 'click',
                      target: e.target.tagName,
                      id: e.target.id,
                      class: e.target.className,
                      text: e.target.textContent?.trim().substring(0, 150) || '',
                      xpath: getXPath(e.target),
                      timestamp: Date.now()
                  });
              }
          }, true);
      }

      function observeKeyPresses() {
          document.addEventListener('keydown', function(e) {
              if (!['Meta', 'Shift', 'Control', 'Alt'].includes(e.key)) {
                  recordAction({
                      type: 'keypress',
                      key: e.key,
                      timestamp: Date.now()
                  });
              }
          }, true);
      }

      function observeFormInputs() {
          document.addEventListener('change', function(e) {
              if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                  recordAction({
                      type: 'input',
                      target: e.target.tagName,
                      id: e.target.id,
                      name: e.target.name,
                      value: e.target.value,
                      xpath: getXPath(e.target),
                      timestamp: Date.now()
                  });
              }
          }, true);
      }

      function getXPath(element: Element): string {
          if (element.id !== '') {
              return 'id("' + element.id + '")';
          }
          if (element === document.body) {
              return element.tagName;
          }

          let ix = 0;
          const siblings = element.parentNode?.childNodes;
          if (siblings) {
              for (let i = 0; i < siblings.length; i++) {
                  const sibling = siblings[i];
                  if (sibling === element) {
                      return getXPath(element.parentNode as Element) + '/' + element.tagName + '[' + (ix + 1) + ']';
                  }
                  if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                      ix++;
                  }
              }
          }
          return '';
      }

      function generateUserScript() {
          let script = `
  // ==UserScript==
  // @name         Auto-Generated Script
  // @namespace    http://tampermonkey.net/
  // @version      0.1
  // @description  Auto-generated script based on user actions
  // @match        ${window.location.href}
  // @grant        none
  // ==/UserScript==

  (function() {
      'use strict';

      function simulateActions() {
  `;

          actions.forEach(action => {
              if (action.type === 'click') {
                  script += `        let element = document.evaluate('${action.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;\n`;
                  script += `        if (element && element.textContent.trim().includes('${action.text}')) {\n`;
                  script += `            element.click();\n`;
                  script += `        }\n`;
              } else if (action.type === 'keypress') {
                  script += `        document.dispatchEvent(new KeyboardEvent('keydown', {'key': '${action.key}'}));\n`;
              } else if (action.type === 'input') {
                  script += `        let inputElement = document.evaluate('${action.xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;\n`;
                  script += `        if (inputElement) {\n`;
                  script += `            inputElement.value = '${action.value}';\n`;
                  script += `            inputElement.dispatchEvent(new Event('change', { bubbles: true }));\n`;
                  script += `        }\n`;
              }
          });

          script += `
      }

      // Run the simulation after a short delay
      setTimeout(simulateActions, 2000);
  })();
  `;

          console.log('Generated UserScript:', script);
          GM_setValue('generatedScript', script);
          return script;
      }

      function startObservation() {
          actions = []; // Reset actions array
          isObserving = true;
          observeClicks();
          observeKeyPresses();
          observeFormInputs();
          console.log('Observation started. Recording actions for 15 minutes...');
          GM_notification({
              text: 'Observation started. Recording actions for 15 minutes...',
              title: 'Auto UserScript Generator',
              timeout: 5000
          });
          setTimeout(() => {
              isObserving = false;
              const generatedScript = generateUserScript();
              console.log('Observation completed. UserScript generated.');
              GM_notification({
                  text: 'Observation completed. UserScript generated.',
                  title: 'Auto UserScript Generator',
                  timeout: 5000
              });
              GM_setClipboard(generatedScript);
              GM_notification({
                  text: 'Generated script copied to clipboard.',
                  title: 'Auto UserScript Generator',
                  timeout: 3000
              });
          }, OBSERVATION_TIME);
      }

      GM_registerMenuCommand('Start Observation', startObservation);

      GM_registerMenuCommand('View Last Generated Script', function() {
          const lastScript = GM_getValue('generatedScript', 'No script generated yet.');
          console.log('Last Generated UserScript:', lastScript);
          GM_notification({
              text: 'Last generated script has been logged to the console.',
              title: 'Auto UserScript Generator',
              timeout: 3000
          });
      });

      GM_registerMenuCommand('Download Last Generated Script', function() {
          const lastScript = GM_getValue('generatedScript', 'No script generated yet.');
          const blob = new Blob([lastScript], {type: 'text/plain'});
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'auto-generated-script.user.js';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          GM_notification({
              text: 'Last generated script has been downloaded.',
              title: 'Auto UserScript Generator',
              timeout: 3000
          });
      });

      GM_registerMenuCommand('Copy Last Generated Script', function() {
          const lastScript = GM_getValue('generatedScript', 'No script generated yet.');
          GM_setClipboard(lastScript);
          GM_notification({
              text: 'Last generated script has been copied to clipboard.',
              title: 'Auto UserScript Generator',
              timeout: 3000
          });
      });

      GM_registerMenuCommand('Clear Recorded Actions', function() {
          actions = [];
          GM_notification({
              text: 'Recorded actions have been cleared.',
              title: 'Auto UserScript Generator',
              timeout: 3000
          });
      });

      GM_registerMenuCommand('Pause/Resume Observation', function() {
          isObserving = !isObserving;
          GM_notification({
              text: isObserving ? 'Observation resumed.' : 'Observation paused.',
              title: 'Auto UserScript Generator',
              timeout: 3000
          });
      });
  })();
