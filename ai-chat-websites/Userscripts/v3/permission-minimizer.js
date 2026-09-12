/**
 * Permission Minimizer (Q1 2027 #9 — permission minimization analysis).
 * Scans generated script source for the API surface it actually touches and
 * reports the minimal userscript @grant / @match / @connect set required.
 */

(function (global) {
  const GRANT_MAP = [
    { pattern: /GM_setValue|GM_getValue|GM_deleteValue|GM_listValues/i, grant: 'GM_setValue' },
    { pattern: /GM_xmlhttpRequest|GM_xhr/i, grant: 'GM_xmlhttpRequest' },
    { pattern: /GM_download/i, grant: 'GM_download' },
    { pattern: /GM_notification/i, grant: 'GM_notification' },
    { pattern: /GM_openInTab/i, grant: 'GM_openInTab' },
    { pattern: /GM_addStyle/i, grant: 'GM_addStyle' },
    { pattern: /GM_addElement/i, grant: 'GM_addElement' },
    { pattern: /GM_setClipboard/i, grant: 'GM_setClipboard' }
  ];
  const HOST_PATTERN = /https?:\/\/[^\/"'`\s]+/g;

  class PermissionMinimizer {
    analyze(source) {
      const text = String(source || '');
      const grants = new Set();
      GRANT_MAP.forEach(rule => {
        if (rule.pattern.test(text)) grants.add(rule.grant);
      });

      const hosts = text.match(HOST_PATTERN) || [];
      const connect = Array.from(new Set(hosts.map(h => {
        const url = new URL(h);
        return url.hostname;
      }))).filter(h => h !== 'localhost');

      const matches = [];
      const m = text.match(/@match\s+([^\s]+)/gi) || [];
      matches.push(...m.map(x => x.split(/\s+/)[1]));

      return {
        grants: Array.from(grants),
        connect,
        matches: matches.length ? matches : ['<host-domain>/*'],
        recommendation: [
          '@grant ' + (Array.from(grants).join('\n// @grant ') || 'none'),
          '@match ' + (matches.length ? matches.join('\n// @match ') : '<host-domain>/*'),
          connect.length ? '@connect ' + connect.join('\n// @connect ') : ''
        ].filter(Boolean)
      };
    }
  }

  global.PermissionMinimizer = PermissionMinimizer;
  if (typeof module !== 'undefined' && module.exports) module.exports = { PermissionMinimizer };
})(typeof window !== 'undefined' ? window : globalThis);