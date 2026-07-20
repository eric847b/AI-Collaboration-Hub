import { useState } from "react";
import { useNexus } from "@/store/nexus";
import { Plus, Save, Tags, History, Columns2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export const PromptLab = () => {
  const { workspace, addPrompt, updatePrompt } = useNexus();
  const [activeId, setActiveId] = useState(workspace.prompts[0]?.id);
  const [compareId, setCompareId] = useState<string | null>(null);
  const active = workspace.prompts.find(p => p.id === activeId);
  const compare = workspace.prompts.find(p => p.id === compareId);
  const [draft, setDraft] = useState(active?.body ?? "");

  const handleSave = () => {
    if (active) updatePrompt(active.id, draft);
  };
  const newPrompt = () => {
    const id = `p_${Date.now()}`;
    addPrompt({ id, title: "Untitled Prompt", tags: ["new"], body: "", versions: [] });
    setActiveId(id);
    setDraft("");
  };

  const compress = (s: string) => s.replace(/\s+/g, " ").replace(/\b(the|a|an|that|which)\b/gi, "").trim();

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-3 glass-strong rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs mono uppercase text-neon-cyan">Prompt Library</h3>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={newPrompt}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex-1 overflow-auto space-y-1.5">
          {workspace.prompts.map(p => (
            <button
              key={p.id}
              onClick={() => { setActiveId(p.id); setDraft(p.body); }}
              className={`w-full text-left glass rounded-lg p-2 transition ${activeId === p.id ? "border-neon-cyan/50 shadow-[0_0_12px_hsl(var(--neon-cyan)/0.25)]" : "hover:border-neon-cyan/30"}`}
            >
              <div className="text-xs font-semibold truncate">{p.title}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {p.tags.map(t => <span key={t} className="text-[9px] mono px-1.5 py-0.5 rounded bg-neon-cyan/10 text-neon-cyan">{t}</span>)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="col-span-9 grid grid-cols-2 gap-3">
        <div className="glass-strong rounded-xl p-3 flex flex-col col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <Input value={active?.title || ""} className="h-7 max-w-xs bg-transparent border-border/40 mono text-sm" readOnly />
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setCompareId(workspace.prompts.find(p => p.id !== activeId)?.id || null)}>
                <Columns2 className="h-3.5 w-3.5" /> Compare
              </Button>
              <Button size="sm" className="h-7 gap-1 bg-neon-cyan text-primary-foreground hover:bg-neon-cyan/80" onClick={handleSave}>
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
            </div>
          </div>
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="flex-1 mono text-xs bg-background/40 resize-none" />
          <div className="flex items-center justify-between mt-2 text-[10px] mono text-muted-foreground">
            <span>{draft.length} chars · {draft.split(/\s+/).filter(Boolean).length} tokens</span>
            <button onClick={() => setDraft(compress(draft))} className="text-neon-violet hover:underline">⊕ COMPRESS</button>
          </div>
        </div>

        <div className="glass-strong rounded-xl p-3 flex flex-col col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs mono uppercase text-neon-violet flex items-center gap-1"><Columns2 className="h-3.5 w-3.5" /> {compare ? compare.title : "Compare"}</h3>
            <select className="bg-transparent border border-border/40 rounded text-xs mono px-2 py-1" value={compareId || ""} onChange={(e) => setCompareId(e.target.value)}>
              <option value="">— select —</option>
              {workspace.prompts.filter(p => p.id !== activeId).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="flex-1 mono text-xs bg-background/40 rounded p-2 overflow-auto whitespace-pre-wrap">
            {compare?.body || <span className="text-muted-foreground">Select a prompt to compare side-by-side.</span>}
          </div>
          <div className="mt-3">
            <h4 className="text-[10px] mono uppercase text-muted-foreground mb-1 flex items-center gap-1"><History className="h-3 w-3" /> Evolution</h4>
            <div className="space-y-1 max-h-24 overflow-auto">
              {(active?.versions || []).slice(0, 5).map((v, i) => (
                <div key={i} className="text-[10px] mono text-muted-foreground truncate flex gap-2">
                  <span className="text-neon-cyan">v.{active!.versions.length - i}</span>
                  <span>{new Date(v.ts).toLocaleString("en-GB")}</span>
                </div>
              ))}
              {!active?.versions.length && <div className="text-[10px] mono text-muted-foreground">No revisions yet.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
