import { useState } from "react";
import { useNexus } from "@/store/nexus";
import { Plus, Search, Trash2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const MemoryVault = () => {
  const { workspace, addNote, removeNote } = useNexus();
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tag, setTag] = useState("note");

  const filtered = workspace.notes.filter(n => !q || n.title.toLowerCase().includes(q.toLowerCase()) || n.body.toLowerCase().includes(q.toLowerCase()) || n.tag.includes(q.toLowerCase()));

  const add = () => {
    if (!title.trim()) return;
    addNote({ id: `n_${Date.now()}`, title, body, tag, ts: Date.now() });
    setTitle(""); setBody("");
  };

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-5 glass-strong rounded-xl p-3 flex flex-col">
        <h3 className="text-xs mono uppercase text-neon-cyan mb-2">New Memory</h3>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="title" className="mb-2 bg-background/40" />
        <Input value={tag} onChange={e => setTag(e.target.value)} placeholder="tag" className="mb-2 bg-background/40 mono text-xs" />
        <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="memory content…" className="flex-1 bg-background/40 mono text-xs resize-none" />
        <Button onClick={add} className="mt-2 gap-1 bg-neon-cyan text-primary-foreground hover:bg-neon-cyan/80"><Plus className="h-3.5 w-3.5" /> Persist</Button>
      </div>
      <div className="col-span-7 glass-strong rounded-xl p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="search timeline / tags / content" className="bg-background/40 border-0 focus-visible:ring-1" />
          <span className="text-[10px] mono text-muted-foreground whitespace-nowrap">{filtered.length} entries</span>
        </div>
        <div className="flex-1 overflow-auto space-y-2 relative pl-4">
          <div className="absolute left-1.5 top-2 bottom-2 w-px bg-gradient-to-b from-neon-cyan via-neon-violet to-neon-magenta opacity-30" />
          {filtered.map(n => (
            <div key={n.id} className="relative glass rounded-lg p-3 hover:border-neon-cyan/40 transition group">
              <div className="absolute -left-3.5 top-4 w-2 h-2 rounded-full bg-neon-cyan shadow-[0_0_8px_hsl(var(--neon-cyan))]" />
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">{n.title}</div>
                <button onClick={() => removeNote(n.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{n.body}</div>
              <div className="flex items-center justify-between mt-2 text-[10px] mono">
                <span className="px-1.5 py-0.5 rounded bg-neon-violet/10 text-neon-violet">{n.tag}</span>
                <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(n.ts).toLocaleString("en-GB")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
