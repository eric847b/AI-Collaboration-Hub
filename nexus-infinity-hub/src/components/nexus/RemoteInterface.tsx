import { Power, Play, Pause, Zap, RefreshCw, GitMerge, Send, Radio, Save, Trash2, Brain, Cpu, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const macros = [
  { icon: Power, label: "BOOT KERNEL", color: "neon-lime" },
  { icon: Play, label: "EXEC ALL", color: "neon-cyan" },
  { icon: Pause, label: "HALT BUS", color: "neon-amber" },
  { icon: Zap, label: "SURGE EVENT", color: "neon-magenta" },
  { icon: RefreshCw, label: "SYNC STATE", color: "neon-cyan" },
  { icon: GitMerge, label: "MERGE BRANCH", color: "neon-violet" },
  { icon: Send, label: "EMIT SIGNAL", color: "neon-lime" },
  { icon: Radio, label: "BROADCAST", color: "neon-cyan" },
  { icon: Save, label: "SNAPSHOT", color: "neon-violet" },
  { icon: Brain, label: "RECALL MEM", color: "neon-magenta" },
  { icon: Cpu, label: "OVERCLOCK", color: "neon-amber" },
  { icon: Sparkles, label: "EVOLVE", color: "neon-cyan" },
];

export const RemoteInterface = () => {
  const [log, setLog] = useState<string[]>(["[00:00:00] remote.online", "[00:00:01] macros.loaded(12)"]);
  const fire = (label: string) => {
    setLog(l => [`[${new Date().toLocaleTimeString("en-GB")}] ${label.toLowerCase().replace(/\s/g, "_")}()`, ...l].slice(0, 20));
    toast.success(label, { description: "Macro dispatched to kernel" });
  };
  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-8 glass-strong rounded-xl p-4 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs mono uppercase text-neon-cyan flex items-center gap-2"><span className="pulse-dot" /> Remote Console</h3>
          <span className="text-[10px] mono text-neon-lime">12 MACROS LOADED</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-3 flex-1">
          {macros.map(m => {
            const I = m.icon;
            return (
              <button key={m.label} onClick={() => fire(m.label)}
                className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-[1.03] transition group relative overflow-hidden"
                style={{ borderColor: `hsl(var(--${m.color}) / 0.3)` }}>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition" style={{ background: `radial-gradient(circle at center, hsl(var(--${m.color}) / 0.2), transparent 70%)` }} />
                <I className="h-6 w-6 relative z-10" style={{ color: `hsl(var(--${m.color}))` }} />
                <span className="text-[10px] mono uppercase relative z-10">{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="col-span-4 glass-strong rounded-xl p-3 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs mono uppercase text-neon-violet">Command Log</h4>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setLog([])}><Trash2 className="h-3 w-3" /></Button>
        </div>
        <div className="flex-1 overflow-auto mono text-[10px] space-y-0.5 bg-background/40 rounded p-2">
          {log.map((l, i) => (
            <div key={i} className="text-neon-cyan animate-fade-in">
              <span className="text-muted-foreground">›</span> {l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
