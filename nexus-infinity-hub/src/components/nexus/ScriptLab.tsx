import { useState } from "react";
import { useNexus } from "@/store/nexus";
import { Plus, Save, Minimize2, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const formatVersion = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}.1`;
};

export const ScriptLab = () => {
  const { workspace, addScript, updateScript } = useNexus();
  const [activeId, setActiveId] = useState(workspace.scripts[0]?.id);
  const active = workspace.scripts.find(s => s.id === activeId);
  const [code, setCode] = useState(active?.code ?? "");

  const minify = (s: string) => s.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}();,:=<>+\-*/])\s*/g, "$1").trim();
  const minified = minify(code);

  const newScript = () => {
    const id = `s_${Date.now()}`;
    addScript({ id, name: "new-userscript", version: formatVersion(), code: "// ==UserScript==\n// @name        New Script\n// @match       *://*/*\n// ==/UserScript==\n", deps: [], updated: Date.now() });
    setActiveId(id);
    setCode("// ==UserScript==\n");
  };

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-3 glass-strong rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs mono uppercase text-neon-cyan">Script Vault</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={newScript}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex-1 overflow-auto space-y-1.5">
          {workspace.scripts.map(s => (
            <button key={s.id} onClick={() => { setActiveId(s.id); setCode(s.code); }}
              className={`w-full text-left glass rounded-lg p-2 transition ${activeId === s.id ? "border-neon-violet/50 shadow-[0_0_12px_hsl(var(--neon-violet)/0.25)]" : "hover:border-neon-violet/30"}`}>
              <div className="text-xs font-semibold truncate">{s.name}</div>
              <div className="text-[9px] mono text-neon-cyan">v {s.version}</div>
              <div className="flex gap-1 mt-1">{s.deps.map(d => <span key={d} className="text-[9px] mono px-1 rounded bg-muted">{d}</span>)}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-9 grid grid-rows-[1fr_auto] gap-3">
        <div className="glass-strong rounded-xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-gradient-to-r from-neon-violet/10 to-transparent">
            <div className="flex items-center gap-3">
              <span className="text-xs mono text-neon-violet">{active?.name}.user.js</span>
              <span className="text-[10px] mono text-muted-foreground">{active?.version}</span>
            </div>
            <Button size="sm" className="h-7 gap-1 bg-neon-violet text-primary-foreground hover:bg-neon-violet/80" onClick={() => active && updateScript(active.id, code)}>
              <Save className="h-3.5 w-3.5" /> Commit
            </Button>
          </div>
          <div className="flex-1 relative">
            <div className="absolute inset-0 pointer-events-none scanline" />
            <Textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false}
              className="h-full mono text-xs bg-background/60 resize-none border-0 rounded-none focus-visible:ring-0 leading-relaxed" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="glass-strong rounded-xl p-3">
            <h4 className="text-[10px] mono uppercase text-neon-cyan flex items-center gap-1 mb-2"><Minimize2 className="h-3 w-3" /> Irreducible-Lossless Minify</h4>
            <div className="mono text-[10px] bg-background/60 rounded p-2 max-h-24 overflow-auto break-all">{minified || <span className="text-muted-foreground">—</span>}</div>
            <div className="text-[10px] mono text-muted-foreground mt-1">
              {code.length} → <span className="text-neon-lime">{minified.length}</span> bytes
              {code.length > 0 && <span className="text-neon-cyan"> · −{Math.round((1 - minified.length / code.length) * 100)}%</span>}
            </div>
          </div>
          <div className="glass-strong rounded-xl p-3">
            <h4 className="text-[10px] mono uppercase text-neon-violet flex items-center gap-1 mb-2"><GitBranch className="h-3 w-3" /> Dependency Map</h4>
            <div className="flex flex-wrap gap-2">
              {(active?.deps || []).map(d => (
                <div key={d} className="flex items-center gap-1 px-2 py-1 rounded glass text-[10px] mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_4px_hsl(var(--neon-cyan))]" />
                  {d}
                </div>
              ))}
              {!active?.deps.length && <span className="text-[10px] mono text-muted-foreground">No dependencies declared</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
