// ==UserScript==
// @name         ControlPanelUI
// @version      2026.05.04.0
// @description  ChatGPT - Floating control panel with shadow DOM isolation
// @author       AI RMD
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://poe.com/*
// @match        https://perplexity.ai/*
// @match        https://www.perplexity.ai/*
// @match        https://pi.ai/*
// @match        https://you.com/*
// @match        https://gemini.google.com/*
// @match        https://aistudio.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://chat.mistral.ai/*
// @grant        GM_addStyle
// ==/UserScript==

/**
 * ControlPanelUI - Floating control panel with shadow DOM isolation
 * Provides visual interface for hub management
 */
(function() {
    'use strict';

    const ControlPanelUI = (() => {
        let root = null;
        let shadow = null;
        let visible = false;
        let dragState = null;

        const PANEL_CSS = `
:host { all: initial; }
*,:before,:after { box-sizing:border-box; margin:0; padding:0; }
:root {
  --bg1:#0d1117;--bg2:#161b22;--bg3:#21262d;--bgc:#1c2129;
  --bdr:#30363d;--bdr-f:#58a6ff;
  --t1:#e6edf3;--t2:#8b949e;--t3:#6e7681;
  --acc:#58a6ff;--acc2:#79c0ff;
  --grn:#3fb950;--grn-d:#1a4028;
  --red:#f85149;--red-d:#4a1e1e;
  --yel:#d29922;--yel-d:#3d2e00;
  --pur:#bc8cff;--cya:#39d2c0;
  --r:8px;--rl:12px;
  --fm:'SF Mono','Cascadia Code','Fira Code','Consolas',monospace;
  --fs:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif;
  --tr:0.2s ease;
}
.hcp-overlay {
  position:fixed;top:40px;right:40px;width:1000px;height:700px;
  background:var(--bg1);border:1px solid var(--bdr);border-radius:var(--rl);
  box-shadow:0 8px 32px rgba(0,0,0,0.6);z-index:2147483646;
  display:flex;flex-direction:column;overflow:hidden;
  font-family:var(--fs);color:var(--t1);font-size:14px;line-height:1.5;
  resize:both;min-width:600px;min-height:400px;
}
.hcp-titlebar {
  display:flex;align-items:center;justify-content:space-between;
  background:var(--bg2);border-bottom:1px solid var(--bdr);
  padding:8px 14px;cursor:grab;user-select:none;flex-shrink:0;
}
.hcp-titlebar:active{cursor:grabbing}
.hcp-titlebar .hcp-logo{display:flex;align-items:center;gap:8px}
.hcp-titlebar .hcp-logo-icon{
  width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,var(--acc),var(--pur));font-size:14px;font-weight:700;color:#fff;
}
.hcp-titlebar h1{font-size:14px;font-weight:600;background:linear-gradient(90deg,var(--acc),var(--pur));-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.hcp-titlebar .hcp-controls{display:flex;align-items:center;gap:8px}
.hcp-titlebar .hcp-conn{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2)}
.hcp-dot{width:7px;height:7px;border-radius:50%;background:var(--yel);animation:hcpPulse 2s infinite}
.hcp-dot.on{background:var(--grn)}.hcp-dot.off{background:var(--red);animation:none}
@keyframes hcpPulse{0%,100%{opacity:1}50%{opacity:.4}}
.hcp-titlebar button.hcp-close{
  width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;
  background:transparent;color:var(--t2);font-size:16px;display:flex;align-items:center;justify-content:center;
}
.hcp-titlebar button.hcp-close:hover{background:var(--red-d);color:var(--red)}
.hcp-tabs{
  display:flex;background:var(--bg2);border-bottom:1px solid var(--bdr);
  padding:0 10px;overflow-x:auto;gap:1px;flex-shrink:0;
}
.hcp-tab{
  padding:7px 12px;font-size:11px;font-weight:500;color:var(--t2);
  background:none;border:none;border-bottom:2px solid transparent;
  cursor:pointer;white-space:nowrap;font-family:var(--fs);
}
.hcp-tab:hover{color:var(--t1);background:var(--bg3)}
.hcp-tab.active{color:var(--acc);border-bottom-color:var(--acc)}
.hcp-body{flex:1;overflow-y:auto;padding:16px}
.hcp-body::-webkit-scrollbar{width:5px}
.hcp-body::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:3px}
.hcp-sec{display:none}.hcp-sec.active{display:block}
.hcp-sec-hdr{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.hcp-sec-hdr h2{font-size:16px;font-weight:600}
.hcp-badge{font-size:10px;font-weight:600;padding:1px 7px;border-radius:9px;background:var(--bg3);color:var(--t2);border:1px solid var(--bdr)}
.hcp-row{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:14px}
.hcp-grp{display:flex;flex-direction:column;gap:3px}
.hcp-grp label{font-size:10px;font-weight:500;color:var(--t2);text-transform:uppercase;letter-spacing:.5px}
.hcp-input,.hcp-select,.hcp-textarea{
  background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);
  color:var(--t1);font-family:var(--fs);font-size:12px;padding:6px 10px;outline:none;
}
.hcp-input:focus,.hcp-select:focus,.hcp-textarea:focus{border-color:var(--bdr-f);box-shadow:0 0 0 2px rgba(88,166,255,.12)}
.hcp-input{min-width:150px}.hcp-select{min-width:140px}
.hcp-textarea{font-family:var(--fm);font-size:11px;min-height:160px;resize:vertical;width:100%;tab-size:2}
.hcp-btn{
  display:inline-flex;align-items:center;gap:5px;padding:6px 12px;
  font-size:11px;font-weight:500;font-family:var(--fs);border-radius:var(--r);
  border:1px solid var(--bdr);cursor:pointer;white-space:nowrap;
}
.hcp-btn-p{background:var(--acc);color:#fff;border-color:var(--acc)}.hcp-btn-p:hover{background:var(--acc2);border-color:var(--acc2)}
.hcp-btn-s{background:var(--bg3);color:var(--t1)}.hcp-btn-s:hover{background:var(--bdr)}
.hcp-btn-d{background:var(--red-d);color:var(--red);border-color:rgba(248,81,73,.3)}.hcp-btn-d:hover{background:rgba(248,81,73,.25)}
.hcp-btn-w{background:var(--yel-d);color:var(--yel);border-color:rgba(210,153,34,.3)}.hcp-btn-w:hover{background:rgba(210,153,34,.25)}
.hcp-btn-g{background:var(--grn-d);color:var(--grn);border-color:rgba(63,185,80,.3)}.hcp-btn-g:hover{background:rgba(63,185,80,.25)}
.hcp-btns{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.hcp-panel{background:var(--bgc);border:1px solid var(--bdr);border-radius:var(--rl);margin-bottom:14px;overflow:hidden}
.hcp-panel-hdr{padding:8px 12px;border-bottom:1px solid var(--bdr);font-size:11px;font-weight:600;color:var(--t2);text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between}
.hcp-panel-body{padding:12px}
.hcp-panel-body.scr{max-height:280px;overflow-y:auto}
.hcp-panel-body.scr::-webkit-scrollbar{width:4px}
.hcp-panel-body.scr::-webkit-scrollbar-thumb{background:var(--bdr);border-radius:2px}
.hcp-empty{text-align:center;padding:28px 16px;color:var(--t3);font-size:12px}
.hcp-empty .hcp-ei{font-size:24px;margin-bottom:8px;opacity:.5;display:block}
.hcp-tbl{width:100%;border-collapse:collapse;font-size:11px}
.hcp-tbl th{text-align:left;padding:7px 10px;font-weight:600;color:var(--t2);border-bottom:1px solid var(--bdr);font-size:10px;text-transform:uppercase;letter-spacing:.5px}
.hcp-tbl td{padding:7px 10px;border-bottom:1px solid rgba(48,54,61,.5);color:var(--t1);vertical-align:middle}
.hcp-tbl tr:last-child td{border-bottom:none}
.hcp-tbl tr:hover td{background:rgba(88,166,255,.04)}
.hcp-tbl tr[data-mod]{cursor:pointer}
.hcp-sb{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:9px;font-size:10px;font-weight:500}
.hcp-sb.active{background:var(--grn-d);color:var(--grn)}.hcp-sb.inactive{background:var(--red-d);color:var(--red)}.hcp-sb.loading{background:var(--yel-d);color:var(--yel)}
.hcp-sb.initialized{background:var(--grn-d);color:var(--grn)}.hcp-sb.pending{background:var(--yel-d);color:var(--yel)}.hcp-sb.failed{background:var(--red-d);color:var(--red)}
.hcp-kv{display:grid;grid-template-columns:130px 1fr;font-size:11px}
.hcp-kv .k{padding:6px 10px;color:var(--t2);font-weight:500;border-bottom:1px solid rgba(48,54,61,.3)}
.hcp-kv .v{padding:6px 10px;border-bottom:1px solid rgba(48,54,61,.3);word-break:break-word}
.hcp-kv .k:last-of-type,.hcp-kv .v:last-of-type{border-bottom:none}
.hcp-log{padding:6px 10px;border-bottom:1px solid rgba(48,54,61,.3);font-family:var(--fm);font-size:10px;line-height:1.6;display:flex;gap:10px}
.hcp-log:last-child{border-bottom:none}
.hcp-log .lt{color:var(--t3);white-space:nowrap;flex-shrink:0}
.hcp-log .lm{word-break:break-word}
.hcp-log.err .lm{color:var(--red)}.hcp-log.wrn .lm{color:var(--yel)}.hcp-log.inf .lm{color:var(--cya)}.hcp-log.suc .lm{color:var(--grn)}
.hcp-mgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;margin-bottom:14px}
.hcp-mc{background:var(--bg3);border:1px solid var(--bdr);border-radius:var(--r);padding:12px}
.hcp-mc .ml{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:var(--t3);margin-bottom:4px}
.hcp-mc .mv{font-size:20px;font-weight:700;font-family:var(--fm)}
.hcp-mc .ms{font-size:10px;color:var(--t2);margin-top:3px}
.mv.blue{color:var(--acc)}.mv.green{color:var(--grn)}.mv.yellow{color:var(--yel)}.mv.purple{color:var(--pur)}.mv.cyan{color:var(--cya)}.mv.red{color:var(--red)}
.hcp-2col{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.hcp-toasts{position:absolute;bottom:12px;right:12px;display:flex;flex-direction:column-reverse;gap:6px;z-index:10;pointer-events:none}
.hcp-toast{
  background:var(--bg2);border:1px solid var(--bdr);border-radius:var(--r);
  padding:8px 12px;font-size:11px;box-shadow:0 2px 8px rgba(0,0,0,.3);
  animation:hcpSlide .3s ease;max-width:280px;pointer-events:auto;
}
.hcp-toast.suc{border-left:3px solid var(--grn)}.hcp-toast.err{border-left:3px solid var(--red)}
.hcp-toast.inf{border-left:3px solid var(--acc)}.hcp-toast.wrn{border-left:3px solid var(--yel)}
@keyframes hcpSlide{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}
`;

        const PANEL_HTML = `
<div class="hcp-overlay" id="hcpOverlay">
  <div class="hcp-titlebar" id="hcpTitlebar">
    <div class="hcp-logo"><div class="hcp-logo-icon">H</div><h1>Hub Control Panel</h1></div>
    <div class="hcp-controls">
      <div class="hcp-conn"><span class="hcp-dot" id="hcpDot"></span><span id="hcpConnLabel">Waiting…</span></div>
      <button class="hcp-close" id="hcpClose" title="Close (Ctrl+Shift+H)">✕</button>
    </div>
  </div>
  <div class="hcp-tabs" id="hcpTabs">
    <button class="hcp-tab active" data-t="modules">📦 Modules</button>
    <button class="hcp-tab" data-t="services">🔌 Services</button>
    <button class="hcp-tab" data-t="memory">🧠 Memory</button>
    <button class="hcp-tab" data-t="config">⚙️ Config</button>
    <button class="hcp-tab" data-t="errors">🛡️ Errors</button>
    <button class="hcp-tab" data-t="perf">📊 Performance</button>
    <button class="hcp-tab" data-t="system">🖥️ System</button>
  </div>
  <div class="hcp-body">
    <div class="hcp-sec active" id="hcp-modules">
      <div class="hcp-sec-hdr"><h2>📦 Module Registry</h2><span class="hcp-badge" id="hcpModCount">0 modules</span></div>
      <div class="hcp-row">
        <div class="hcp-grp"><label>Module Name</label><input class="hcp-input" id="hcpModName" placeholder="e.g. automation"></div>
        <div class="hcp-grp"><label>Module URL</label><input class="hcp-input" id="hcpModURL" placeholder="https://..."></div>
        <div class="hcp-grp"><label>Action</label>
          <select class="hcp-select" id="hcpModAction">
            <option value="registerModule">Register Module</option><option value="reloadModule">Reload Module</option>
            <option value="unloadModule">Unload Module</option><option value="refreshRegistry">Refresh Registry</option>
            <option value="inspectModule">Inspect Module</option>
          </select>
        </div>
        <button class="hcp-btn hcp-btn-p" id="hcpModExec">▶ Execute</button>
      </div>
      <div class="hcp-panel"><div class="hcp-panel-hdr">Loaded Modules</div>
        <div class="hcp-panel-body" id="hcpModTableWrap">
          <table class="hcp-tbl"><thead><tr><th>Name</th><th>Version</th><th>Status</th><th>Load Time</th><th>Healthy</th></tr></thead>
            <tbody id="hcpModBody"><tr><td colspan="5"><div class="hcp-empty"><span class="hcp-ei">📦</span>No modules loaded. Use Refresh Registry.</div></td></tr></tbody>
          </table>
        </div>
      </div>
      <div class="hcp-panel"><div class="hcp-panel-hdr">Module Details</div><div class="hcp-panel-body" id="hcpModDetails"><div class="hcp-empty"><span class="hcp-ei">🔍</span>Select a module to inspect.</div></div></div>
    </div>
    <div class="hcp-sec" id="hcp-services">
      <div class="hcp-sec-hdr"><h2>🔌 Service Container Inspector</h2></div>
      <div class="hcp-row">
        <div class="hcp-grp"><label>Service</label><select class="hcp-select" id="hcpSvcSelect"><option value="">— Select —</option></select></div>
        <button class="hcp-btn hcp-btn-p" id="hcpSvcInspect">🔍 Inspect</button>
      </div>
      <div class="hcp-panel"><div class="hcp-panel-hdr">Service Info</div><div class="hcp-panel-body" id="hcpSvcInfo"><div class="hcp-empty"><span class="hcp-ei">🔌</span>Select a service and click Inspect.</div></div></div>
    </div>
    <div class="hcp-sec" id="hcp-memory">
      <div class="hcp-sec-hdr"><h2>🧠 Memory Manager</h2></div>
      <div class="hcp-btns">
        <button class="hcp-btn hcp-btn-p" id="hcpMemRecord">📝 Record Sample</button>
        <button class="hcp-btn hcp-btn-s" id="hcpMemStats">📊 Show Stats</button>
        <button class="hcp-btn hcp-btn-w" id="hcpMemCleanup">🧹 Cleanup</button>
      </div>
      <div class="hcp-2col">
        <div class="hcp-panel"><div class="hcp-panel-hdr">Memory Samples <span class="hcp-badge" id="hcpSampleCount">0</span></div><div class="hcp-panel-body scr" id="hcpMemSamples"><div class="hcp-empty"><span class="hcp-ei">📝</span>No samples recorded.</div></div></div>
        <div class="hcp-panel"><div class="hcp-panel-hdr">Memory Stats</div><div class="hcp-panel-body" id="hcpMemStatsPanel"><div class="hcp-empty"><span class="hcp-ei">📊</span>Click Show Stats.</div></div></div>
      </div>
    </div>
    <div class="hcp-sec" id="hcp-config">
      <div class="hcp-sec-hdr"><h2>⚙️ Config Manager</h2></div>
      <div class="hcp-row">
        <div class="hcp-grp"><label>Module</label>
          <select class="hcp-select" id="hcpCfgModule">
            <option value="hub">hub</option><option value="automation">automation</option>
            <option value="errorHandling">errorHandling</option><option value="ui">ui</option>
            <option value="promptSplitter">promptSplitter</option><option value="codeShrinker">codeShrinker</option>
          </select>
        </div>
        <button class="hcp-btn hcp-btn-s" id="hcpCfgLoad">📥 Load</button>
        <button class="hcp-btn hcp-btn-p" id="hcpCfgSave">💾 Save</button>
        <button class="hcp-btn hcp-btn-d" id="hcpCfgReset">🔄 Reset</button>
      </div>
      <div class="hcp-2col">
        <div class="hcp-panel"><div class="hcp-panel-hdr">Config Editor</div><div class="hcp-panel-body"><textarea class="hcp-textarea" id="hcpCfgEditor" spellcheck="false">{}</textarea></div></div>
        <div>
          <div class="hcp-panel"><div class="hcp-panel-hdr">Current Config</div><div class="hcp-panel-body scr" id="hcpCfgCurrent"><div class="hcp-empty"><span class="hcp-ei">⚙️</span>Load a config to view.</div></div></div>
          <div class="hcp-panel"><div class="hcp-panel-hdr">Config Log <span class="hcp-badge" id="hcpCfgLogCount">0</span></div><div class="hcp-panel-body scr" id="hcpCfgLog"><div class="hcp-empty"><span class="hcp-ei">📋</span>No updates yet.</div></div></div>
        </div>
      </div>
    </div>
    <div class="hcp-sec" id="hcp-errors">
      <div class="hcp-sec-hdr"><h2>🛡️ Error & Event Monitor</h2></div>
      <div class="hcp-2col">
        <div>
          <div class="hcp-btns"><button class="hcp-btn hcp-btn-s" id="hcpErrShow">📋 Show Errors</button><button class="hcp-btn hcp-btn-d" id="hcpErrClear">🗑️ Clear</button></div>
          <div class="hcp-panel"><div class="hcp-panel-hdr">Errors <span class="hcp-badge" id="hcpErrCount">0</span></div><div class="hcp-panel-body scr" id="hcpErrPanel"><div class="hcp-empty"><span class="hcp-ei">✅</span>No errors.</div></div></div>
        </div>
        <div>
          <div class="hcp-btns"><button class="hcp-btn hcp-btn-s" id="hcpEvtShow">📡 Show Events</button><button class="hcp-btn hcp-btn-w" id="hcpEvtPause">⏸ Pause</button></div>
          <div class="hcp-panel"><div class="hcp-panel-hdr">Event Stream <span class="hcp-badge" id="hcpEvtCount">0</span></div><div class="hcp-panel-body scr" id="hcpEvtPanel"><div class="hcp-empty"><span class="hcp-ei">📡</span>No events yet.</div></div></div>
        </div>
      </div>
    </div>
    <div class="hcp-sec" id="hcp-perf">
      <div class="hcp-sec-hdr"><h2>📊 Performance Dashboard</h2></div>
      <div class="hcp-btns">
        <button class="hcp-btn hcp-btn-p" id="hcpPerfShow">📊 Show Metrics</button>
        <button class="hcp-btn hcp-btn-d" id="hcpPerfReset">🔄 Reset</button>
      </div>
      <div class="hcp-mgrid">
        <div class="hcp-mc"><div class="ml">Module Exec</div><div class="mv blue" id="hcpPmExec">—</div><div class="ms">avg ms</div></div>
        <div class="hcp-mc"><div class="ml">Service Init</div><div class="mv green" id="hcpPmInit">—</div><div class="ms">avg ms</div></div>
        <div class="hcp-mc"><div class="ml">Queue</div><div class="mv yellow" id="hcpPmQueue">—</div><div class="ms">pending</div></div>
        <div class="hcp-mc"><div class="ml">Workers</div><div class="mv purple" id="hcpPmWork">—</div><div class="ms">active / total</div></div>
        <div class="hcp-mc"><div class="ml">Batching</div><div class="mv cyan" id="hcpPmBatch">—</div><div class="ms">batched / total</div></div>
      </div>
      <div class="hcp-panel"><div class="hcp-panel-hdr">Detailed Data</div><div class="hcp-panel-body scr" id="hcpPerfDetail"><div class="hcp-empty"><span class="hcp-ei">📊</span>Click Show Metrics.</div></div></div>
    </div>
    <div class="hcp-sec" id="hcp-system">
      <div class="hcp-sec-hdr"><h2>🖥️ System Commands</h2></div>
      <div class="hcp-btns">
        <button class="hcp-btn hcp-btn-p hcp-sys" data-cmd="restart">🔄 Restart Hub</button>
        <button class="hcp-btn hcp-btn-d hcp-sys" data-cmd="shutdown">⏹️ Shutdown</button>
        <button class="hcp-btn hcp-btn-s hcp-sys" data-cmd="reloadAll">📦 Reload All</button>
        <button class="hcp-btn hcp-btn-w hcp-sys" data-cmd="flushCache">🧹 Flush Cache</button>
        <button class="hcp-btn hcp-btn-d hcp-sys" data-cmd="forceGC">♻️ Force GC</button>
      </div>
      <div class="hcp-panel"><div class="hcp-panel-hdr">System Status</div>
        <div class="hcp-panel-body">
          <div class="hcp-kv">
            <div class="k">Last Command</div><div class="v" id="hcpSysCmd">—</div>
            <div class="k">Result</div><div class="v" id="hcpSysRes">—</div>
            <div class="k">Timestamp</div><div class="v" id="hcpSysTs">—</div>
            <div class="k">Notes</div><div class="v" id="hcpSysNotes">—</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="hcp-toasts" id="hcpToasts"></div>
</div>`;

        const st = {
            modules:[], services:[], moduleDetails:{},
            memorySamples:[], memoryStats:{},
            configLog:[], errors:[], events:[], eventsPaused:false,
            performance:{},
            systemStatus:{ lastCommand:'', result:'', timestamp:'', notes:'' }
        };

        const esc = s => { if(s==null) return ''; const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; };
        const ts = () => new Date().toLocaleTimeString('en-US',{hour12:false,hour:'2-digit',minute:'2-digit',second:'2-digit'});
        const q = sel => shadow.querySelector(sel);
        const qa = sel => shadow.querySelectorAll(sel);

        function emit(detail) {
            window.dispatchEvent(new CustomEvent('HubCommand', { detail }));
            toast('inf', 'Sent: ' + detail.type);
        }

        function toast(type, msg) {
            const el = document.createElement('div');
            el.className = 'hcp-toast ' + type;
            el.textContent = msg;
            const container = q('#hcpToasts');
            if (container) {
                container.appendChild(el);
                setTimeout(() => { el.style.opacity='0'; setTimeout(()=>el.remove(),300); }, 3000);
            }
        }

        function renderModulesTable() {
            const tbody = q('#hcpModBody');
            if (!st.modules.length) {
                tbody.innerHTML = '<tr><td colspan="5"><div class="hcp-empty"><span class="hcp-ei">📦</span>No modules loaded. Use Refresh Registry.</div></td></tr>';
                q('#hcpModCount').textContent = '0 modules';
                return;
            }
            q('#hcpModCount').textContent = st.modules.length + ' module' + (st.modules.length!==1?'s':'');
            tbody.innerHTML = st.modules.map(m => `<tr data-mod="${esc(m.name)}">
                <td><strong>${esc(m.name)}</strong></td>
                <td style="font-family:var(--fm);font-size:10px">${esc(m.version||'—')}</td>
                <td><span class="hcp-sb ${m.status==='active'?'active':m.status==='loading'?'loading':'inactive'}">${esc(m.status)}</span></td>
                <td style="font-family:var(--fm);font-size:10px">${esc(m.loadTime||'—')}</td>
                <td>${m.healthy?'<span style="color:var(--grn)">✔</span>':'<span style="color:var(--red)">✘</span>'}</td>
            </tr>`).join('');
            tbody.querySelectorAll('tr[data-mod]').forEach(row => {
                row.addEventListener('click', () => {
                    q('#hcpModName').value = row.dataset.mod;
                    q('#hcpModAction').value = 'inspectModule';
                    emit({ type:'inspectModule', moduleName: row.dataset.mod });
                });
            });
        }

        function renderModuleDetails() {
            const p = q('#hcpModDetails'), d = st.moduleDetails;
            if (!d||!Object.keys(d).length) { p.innerHTML='<div class="hcp-empty"><span class="hcp-ei">🔍</span>Select a module to inspect.</div>'; return; }
            p.innerHTML = `<div class="hcp-kv">
                <div class="k">Dependencies</div><div class="v">${esc(Array.isArray(d.dependencies)?d.dependencies.join(', '):d.dependencies||'None')}</div>
                <div class="k">Methods</div><div class="v" style="font-family:var(--fm);font-size:10px">${esc(Array.isArray(d.methods)?d.methods.join(', '):d.methods||'None')}</div>
                <div class="k">State</div><div class="v"><pre style="margin:0;white-space:pre-wrap;font-size:10px;font-family:var(--fm);color:var(--t1)">${esc(typeof d.state==='object'?JSON.stringify(d.state,null,2):String(d.state||'—'))}</pre></div>
                <div class="k">Errors</div><div class="v">${d.errors&&d.errors.length?d.errors.map(e=>'<div style="color:var(--red)">'+esc(e)+'</div>').join(''):'<span style="color:var(--grn)">None</span>'}</div>
            </div>`;
        }

        function renderServiceDropdown() {
            const sel = q('#hcpSvcSelect'), cur = sel.value;
            sel.innerHTML = '<option value="">— Select —</option>';
            st.services.forEach(s => { const o=document.createElement('option'); o.value=s; o.textContent=s; sel.appendChild(o); });
            if (cur && st.services.includes(cur)) sel.value = cur;
        }

        function renderServiceInfo() {
            const p = q('#hcpSvcInfo'), d = st.serviceDetails;
            if(!d||!Object.keys(d).length){p.innerHTML='<div class="hcp-empty"><span class="hcp-ei">🔌</span>Select a service.</div>';return;}
            const sc=d.status==='initialized'?'initialized':d.status==='pending'?'pending':'failed';
            p.innerHTML=`<div class="hcp-kv">
                <div class="k">Status</div><div class="v"><span class="hcp-sb ${sc}">${esc(d.status)}</span></div>
                <div class="k">Init State</div><div class="v">${esc(d.initState||'—')}</div>
                <div class="k">Dependencies</div><div class="v">${esc(Array.isArray(d.dependencies)?d.dependencies.join(', '):d.dependencies||'None')}</div>
                <div class="k">Calls</div><div class="v" style="font-family:var(--fm)">${esc(d.metrics?.calls??'—')}</div>
                <div class="k">Total Time</div><div class="v" style="font-family:var(--fm)">${esc(d.metrics?.totalTime?d.metrics.totalTime+' ms':'—')}</div>
                <div class="k">Errors</div><div class="v">${d.errors&&d.errors.length?d.errors.map(e=>'<div style="color:var(--red)">'+esc(e)+'</div>').join(''):'<span style="color:var(--grn)">None</span>'}</div>
            </div>`;
        }

        function renderMemorySamples() {
            const p=q('#hcpMemSamples');
            if(!st.memorySamples.length){p.innerHTML='<div class="hcp-empty"><span class="hcp-ei">📝</span>No samples.</div>';q('#hcpSampleCount').textContent='0';return;}
            q('#hcpSampleCount').textContent=st.memorySamples.length;
            p.innerHTML='<table class="hcp-tbl"><thead><tr><th>Time</th><th>Used</th><th>Total</th><th>Limit</th></tr></thead><tbody>'+
                st.memorySamples.map(s=>`<tr><td style="font-family:var(--fm);font-size:10px">${esc(s.timestamp)}</td><td style="font-family:var(--fm);font-size:10px">${esc(s.usedHeap)}</td><td style="font-family:var(--fm);font-size:10px">${esc(s.totalHeap)}</td><td style="font-family:var(--fm);font-size:10px">${esc(s.limit)}</td></tr>`).join('')+'</tbody></table>';
        }

        function renderMemoryStats() {
            const p=q('#hcpMemStatsPanel'),d=st.memoryStats;
            if(!d||!Object.keys(d).length){p.innerHTML='<div class="hcp-empty"><span class="hcp-ei">📊</span>Click Show Stats.</div>';return;}
            p.innerHTML=`<div class="hcp-kv">
                <div class="k">Average</div><div class="v" style="font-family:var(--fm)">${esc(d.average)}</div>
                <div class="k">Peak</div><div class="v" style="font-family:var(--fm)">${esc(d.peak)}</div>
                <div class="k">Current</div><div class="v" style="font-family:var(--fm)">${esc(d.current)}</div>
                <div class="k">Threshold</div><div class="v" style="font-family:var(--fm)">${esc(d.threshold)}</div>
            </div>`;
        }

        function renderConfigCurrent(data) {
            q('#hcpCfgCurrent').innerHTML='<pre style="margin:0;white-space:pre-wrap;font-size:10px;font-family:var(--fm);color:var(--t1)">'+esc(JSON.stringify(data,null,2))+'</pre>';
        }

        function addConfigLog(entry) {
            st.configLog.push(entry);
            q('#hcpCfgLogCount').textContent=st.configLog.length;
            const p=q('#hcpCfgLog');
            p.innerHTML=st.configLog.map(e=>`<div class="hcp-log suc"><span class="lt">${esc(new Date(e.timestamp).toLocaleTimeString())}</span><span class="lm">${esc(e.summary)}</span></div>`).join('');
        }

        function renderErrors() {
            const p=q('#hcpErrPanel');
            q('#hcpErrCount').textContent=st.errors.length;
            if(!st.errors.length){p.innerHTML='<div class="hcp-empty"><span class="hcp-ei">✅</span>No errors.</div>';return;}
            p.innerHTML=st.errors.map(e=>`<div class="hcp-log err"><span class="lt">${esc(new Date(e.timestamp).toLocaleTimeString())}</span><span class="lm">[${esc(e.context)}] ${esc(e.message)}</span></div>`).join('');
            p.scrollTop=p.scrollHeight;
        }

        function addEvent(evt) {
            if(st.eventsPaused) return;
            st.events.push(evt);
            if(st.events.length>300) st.events.shift();
            q('#hcpEvtCount').textContent=st.events.length;
            const p=q('#hcpEvtPanel');
            p.innerHTML=st.events.map(e=>`<div class="hcp-log inf"><span class="lt">${esc(new Date(e.timestamp).toLocaleTimeString())}</span><span class="lm">${esc(e.event)} ${e.module?'('+esc(e.module)+')':''}</span></div>`).join('');
            p.scrollTop=p.scrollHeight;
        }

        function renderPerformance(perf) {
            st.performance=perf;
            const me=perf.moduleExecTimes||[], si=perf.serviceInitTimes||[];
            q('#hcpPmExec').textContent=me.length?me.map(m=>m.time).join(', '):'—';
            q('#hcpPmInit').textContent=si.length?si.map(s=>s.time+'ms').join(', '):'—';
            q('#hcpPmQueue').textContent=String(perf.queueLengths??'—');
            q('#hcpPmWork').textContent=(perf.workerThreads??0)+' / '+(perf.workerThreadsTotal??0);
            q('#hcpPmBatch').textContent=(perf.requestBatching?.batched??0)+' / '+(perf.requestBatching?.total??0);
            const dp=q('#hcpPerfDetail');
            dp.innerHTML='<pre style="margin:0;white-space:pre-wrap;font-size:10px;font-family:var(--fm);color:var(--t1)">'+esc(JSON.stringify(perf,null,2))+'</pre>';
        }

        function renderSystemStatus(s) {
            st.systemStatus=s;
            q('#hcpSysCmd').textContent=s.command||'—';
            q('#hcpSysRes').textContent=s.result||'—';
            q('#hcpSysTs').textContent=s.timestamp?new Date(s.timestamp).toLocaleTimeString():'—';
            q('#hcpSysNotes').textContent=s.notes||'—';
        }

        function onHubResponse(e) {
            const d=e.detail; if(!d) return;
            switch(d.type) {
                case 'heartbeat': q('#hcpDot').className='hcp-dot on'; q('#hcpConnLabel').textContent='Connected'; break;
                case 'refreshRegistry': st.modules=d.modules||[]; st.services=d.services||[]; renderModulesTable(); renderServiceDropdown(); break;
                case 'registerModule': case 'reloadModule': case 'unloadModule': toast('suc', d.module+' — '+d.type); break;
                case 'inspectModule': st.moduleDetails=d.moduleDetails||{}; renderModuleDetails(); break;
                case 'inspectService': st.serviceDetails=d.serviceDetails||{}; renderServiceInfo(); break;
                case 'memoryRecord': st.memorySamples=d.samples||[]; renderMemorySamples(); break;
                case 'memoryStats': st.memoryStats=d.memoryStats||{}; renderMemoryStats(); break;
                case 'memoryCleanup': toast('suc','Cleanup done'); break;
                case 'configLoad': if(d.configData){ q('#hcpCfgEditor').value=JSON.stringify(d.configData,null,2); renderConfigCurrent(d.configData); } break;
                case 'configSave': toast('suc','Config saved'); if(d.logEntry) addConfigLog(d.logEntry); break;
                case 'configReset': toast('suc','Config reset'); if(d.configData){ q('#hcpCfgEditor').value=JSON.stringify(d.configData,null,2); renderConfigCurrent(d.configData); } if(d.logEntry) addConfigLog(d.logEntry); break;
                case 'showErrors': st.errors=d.errors||[]; renderErrors(); break;
                case 'clearErrors': st.errors=[]; renderErrors(); toast('suc','Errors cleared'); break;
                case 'performanceMetrics': if(d.performance) renderPerformance(d.performance); break;
                case 'performanceReset': toast('suc','Metrics reset'); break;
            }
        }
        function onHubError(e) { const d=e.detail; if(!d) return; st.errors.push(d); renderErrors(); }
        function onHubEvent(e) { const d=e.detail; if(!d) return; addEvent(d); }
        function onHubSystem(e) { const d=e.detail; if(!d) return; renderSystemStatus(d); }

        function initDrag() {
            const bar = q('#hcpTitlebar'), overlay = q('#hcpOverlay');
            bar.addEventListener('mousedown', e => {
                if (e.target.closest('button')) return;
                dragState = { x: e.clientX - overlay.offsetLeft, y: e.clientY - overlay.offsetTop };
                e.preventDefault();
            });
            document.addEventListener('mousemove', e => {
                if (!dragState) return;
                overlay.style.left = (e.clientX - dragState.x) + 'px';
                overlay.style.top = (e.clientY - dragState.y) + 'px';
                overlay.style.right = 'auto';
            });
            document.addEventListener('mouseup', () => { dragState = null; });
        }

        function wireActions() {
            qa('.hcp-tab').forEach(tab => tab.addEventListener('click', () => {
                qa('.hcp-tab').forEach(t=>t.classList.remove('active'));
                tab.classList.add('active');
                qa('.hcp-sec').forEach(s=>s.classList.remove('active'));
                q('#hcp-'+tab.dataset.t).classList.add('active');
            }));
            q('#hcpClose').addEventListener('click', () => toggle(false));
            q('#hcpModExec').addEventListener('click', () => {
                const action=q('#hcpModAction').value, name=q('#hcpModName').value.trim(), url=q('#hcpModURL').value.trim();
                if(['registerModule','reloadModule','unloadModule','inspectModule'].includes(action)&&!name){toast('wrn','Name required');return;}
                if(action==='registerModule'&&!url){toast('wrn','URL required');return;}
                emit({type:action, moduleName:name, moduleURL:url});
            });
            q('#hcpSvcInspect').addEventListener('click',()=>{
                const n=q('#hcpSvcSelect').value; if(!n){toast('wrn','Select a service');return;} emit({type:'inspectService',serviceName:n});
            });
            q('#hcpMemRecord').addEventListener('click',()=>emit({type:'memoryRecord'}));
            q('#hcpMemStats').addEventListener('click',()=>emit({type:'memoryStats'}));
            q('#hcpMemCleanup').addEventListener('click',()=>emit({type:'memoryCleanup'}));
            q('#hcpCfgLoad').addEventListener('click',()=>emit({type:'configLoad',module:q('#hcpCfgModule').value}));
            q('#hcpCfgSave').addEventListener('click',()=>{
                const mod=q('#hcpCfgModule').value, raw=q('#hcpCfgEditor').value;
                try{JSON.parse(raw)}catch(e){toast('err','Invalid JSON: '+e.message);return;}
                emit({type:'configSave',module:mod,payload:raw});
            });
            q('#hcpCfgReset').addEventListener('click',()=>emit({type:'configReset',module:q('#hcpCfgModule').value}));
            q('#hcpErrShow').addEventListener('click',()=>emit({type:'showErrors'}));
            q('#hcpErrClear').addEventListener('click',()=>emit({type:'clearErrors'}));
            q('#hcpEvtShow').addEventListener('click',()=>{st.eventsPaused=false;q('#hcpEvtPause').textContent='⏸ Pause';toast('inf','Event stream active');});
            q('#hcpEvtPause').addEventListener('click',()=>{st.eventsPaused=!st.eventsPaused;q('#hcpEvtPause').textContent=st.eventsPaused?'▶ Resume':'⏸ Pause';toast('inf',st.eventsPaused?'Paused':'Resumed');});
            q('#hcpPerfShow').addEventListener('click',()=>emit({type:'performanceMetrics'}));
            q('#hcpPerfReset').addEventListener('click',()=>emit({type:'performanceReset'}));
            qa('.hcp-sys').forEach(btn=>btn.addEventListener('click',()=>emit({type:'systemCommand',command:btn.dataset.cmd})));
        }

        let fab = null;
        function createFAB() {
            fab = document.createElement('div');
            fab.id = 'hcp-fab';
            Object.assign(fab.style, {
                position:'fixed', bottom:'24px', right:'24px', width:'48px', height:'48px',
                borderRadius:'50%', cursor:'pointer', zIndex:'2147483645',
                background:'linear-gradient(135deg,#58a6ff,#bc8cff)',
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:'0 4px 16px rgba(0,0,0,.4)', transition:'transform 0.2s ease',
                fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',
                fontSize:'20px', fontWeight:'700', color:'#fff', userSelect:'none'
            });
            fab.textContent = 'H';
            fab.title = 'Hub Control Panel (Ctrl+Shift+H)';
            fab.addEventListener('mouseenter', () => { fab.style.transform='scale(1.1)'; });
            fab.addEventListener('mouseleave', () => { fab.style.transform='scale(1)'; });
            fab.addEventListener('click', () => toggle());
            document.body.appendChild(fab);
        }

        function toggle(force) {
            visible = typeof force === 'boolean' ? force : !visible;
            if (root) root.style.display = visible ? 'block' : 'none';
            if (fab) fab.style.display = visible ? 'none' : 'flex';
        }

        function onKeydown(e) {
            if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
                e.preventDefault(); toggle();
            }
        }

        return {
            init() {
                if (root) return;
                root = document.createElement('div');
                root.id = 'hcp-root';
                root.style.display = 'none';
                document.body.appendChild(root);

                shadow = root.attachShadow({ mode: 'open' });
                const style = document.createElement('style');
                style.textContent = PANEL_CSS;
                shadow.appendChild(style);
                const container = document.createElement('div');
                container.innerHTML = PANEL_HTML;
                shadow.appendChild(container);

                wireActions();
                initDrag();
                createFAB();

                window.addEventListener('HubResponse', onHubResponse);
                window.addEventListener('HubError', onHubError);
                window.addEventListener('HubEvent', onHubEvent);
                window.addEventListener('HubSystem', onHubSystem);
                window.addEventListener('keydown', onKeydown);

                console.log('[ControlPanelUI] Initialized');
            },

            destroy() {
                window.removeEventListener('HubResponse', onHubResponse);
                window.removeEventListener('HubError', onHubError);
                window.removeEventListener('HubEvent', onHubEvent);
                window.removeEventListener('HubSystem', onHubSystem);
                window.removeEventListener('keydown', onKeydown);
                if (root) { root.remove(); root = null; shadow = null; }
                if (fab) { fab.remove(); fab = null; }
                visible = false;
                console.log('[ControlPanelUI] Destroyed');
            },

            toggle,
            get visible() { return visible; }
        };
    })();

    window.ControlPanelUI = ControlPanelUI;

    console.log('[ControlPanelUI] Initialized v2026.05.04.0');
})();