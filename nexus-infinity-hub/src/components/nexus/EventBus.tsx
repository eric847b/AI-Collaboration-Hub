import { useEffect, useRef, useState } from "react";
import { Play, Pause, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

type Ev = { id: number; ts: number; ch: string; payload: string; node: string };

export const EventBus = () => {
  const [events, setEvents] = useState<Ev[]>([]);
  const [running, setRunning] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const idRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      const channels = ["kernel", "graph", "script", "prompt", "memory", "signal", "remote"];
      const nodes = ["α-7", "β-3", "γ-12", "δ-5", "ω-1"];
      const ch = channels[Math.floor(Math.random() * channels.length)];
      const ev: Ev = {
        id: idRef.current++,
        ts: Date.now(),
        ch,
        payload: `0x${Math.random().toString(16).slice(2, 10)}`,
        node: nodes[Math.floor(Math.random() * nodes.length)],
      };
      setEvents(prev => [ev, ...prev].slice(0, 200));
    }, 400 + Math.random() * 600);
    return () => clearInterval(t);
  }, [running]);

  const fire = () => {
    setEvents(prev => [{ id: idRef.current++, ts: Date.now(), ch: "manual", payload: `0xMANUAL${Date.now().toString(16).slice(-4)}`, node: "USR" }, ...prev]);
  };

  const filtered = events.filter(e => !filter || e.ch === filter);
  const channels = Array.from(new Set(events.map(e => e.ch)));

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-8 glass-strong rounded-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <span className="pulse-dot" />
            <h3 className="text-xs mono uppercase text-neon-cyan">Live Event Stream</h3>
            <span className="text-[10px] mono text-muted-foreground">· {filtered.length} events</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={fire}><Zap className="h-3.5 w-3.5 text-neon-amber" /> Fire</Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setRunning(r => !r)}>
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {running ? "Pause" : "Resume"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setEvents([])}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-0.5 mono text-[11px]">
          {filtered.map(e => (
            <div key={e.id} className="flex gap-3 px-2 py-1 rounded hover:bg-neon-cyan/5 animate-fade-in">
              <span className="text-muted-foreground w-20">{new Date(e.ts).toLocaleTimeString("en-GB")}</span>
              <span className="text-neon-cyan uppercase w-16">{e.ch}</span>
              <span className="text-neon-violet w-12">{e.node}</span>
              <span className="text-foreground/80 truncate">{e.payload}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-4 space-y-3 flex flex-col">
        <div className="glass-strong rounded-xl p-3">
          <h4 className="text-[10px] mono uppercase text-neon-violet mb-2">Channel Filter</h4>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("")} className={`text-[10px] mono px-2 py-1 rounded ${filter === "" ? "bg-neon-cyan/20 text-neon-cyan" : "bg-muted text-muted-foreground"}`}>ALL</button>
            {channels.map(c => (
              <button key={c} onClick={() => setFilter(c)} className={`text-[10px] mono px-2 py-1 rounded uppercase ${filter === c ? "bg-neon-cyan/20 text-neon-cyan" : "bg-muted text-muted-foreground hover:bg-neon-cyan/10"}`}>{c}</button>
            ))}
          </div>
        </div>
        <div className="glass-strong rounded-xl p-3 flex-1">
          <h4 className="text-[10px] mono uppercase text-neon-cyan mb-2">Node Activity</h4>
          <div className="space-y-2">
            {["α-7", "β-3", "γ-12", "δ-5", "ω-1"].map((n, i) => {
              const count = events.filter(e => e.node === n).length;
              return (
                <div key={n}>
                  <div className="flex justify-between text-[10px] mono">
                    <span className="text-neon-violet">{n}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-1 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-neon-cyan to-neon-violet" style={{ width: `${Math.min(100, count * 4)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
