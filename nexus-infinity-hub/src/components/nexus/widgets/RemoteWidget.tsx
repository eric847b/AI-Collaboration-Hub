import { Power, Play, Pause, Zap, RefreshCw, GitMerge, Send } from "lucide-react";
import { toast } from "sonner";

const actions = [
  { icon: Power, label: "BOOT", color: "text-neon-lime" },
  { icon: Play, label: "EXEC", color: "text-neon-cyan" },
  { icon: Pause, label: "HALT", color: "text-neon-amber" },
  { icon: Zap, label: "SURGE", color: "text-neon-magenta" },
  { icon: RefreshCw, label: "SYNC", color: "text-neon-cyan" },
  { icon: GitMerge, label: "MERGE", color: "text-neon-violet" },
  { icon: Send, label: "EMIT", color: "text-neon-lime" },
];

export const RemoteWidget = () => {
  return (
    <div className="space-y-2">
      <div className="text-[10px] mono text-muted-foreground">QUICK_ACTIONS :: macro_grid</div>
      <div className="grid grid-cols-3 gap-2">
        {actions.map(a => {
          const I = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => toast(`${a.label} dispatched`, { description: `Macro ${a.label.toLowerCase()}() executed` })}
              className="glass rounded-lg p-2 flex flex-col items-center gap-1 hover:border-neon-cyan/50 hover:shadow-[0_0_15px_hsl(var(--neon-cyan)/0.3)] transition"
            >
              <I className={`h-4 w-4 ${a.color}`} />
              <span className="text-[10px] mono">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
