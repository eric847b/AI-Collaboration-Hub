import { useNexus } from "@/store/nexus";
import { Activity, Database, HardDrive } from "lucide-react";

export const KernelWidget = () => {
  const { workspace } = useNexus();
  const stats = [
    { label: "Prompts", val: workspace.prompts.length, color: "text-neon-cyan" },
    { label: "Scripts", val: workspace.scripts.length, color: "text-neon-violet" },
    { label: "Notes", val: workspace.notes.length, color: "text-neon-magenta" },
    { label: "Files", val: workspace.files.length, color: "text-neon-lime" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs mono text-muted-foreground">
        <Activity className="h-3 w-3 text-neon-lime" /> KERNEL_STATE :: ACTIVE
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map(s => (
          <div key={s.label} className="glass rounded-lg p-3">
            <div className="text-[10px] mono uppercase text-muted-foreground">{s.label}</div>
            <div className={`text-2xl font-bold mono ${s.color}`}>{String(s.val).padStart(3, "0")}</div>
          </div>
        ))}
      </div>
      <div className="space-y-1.5 mt-2">
        <div className="flex items-center justify-between text-[10px] mono">
          <span className="text-muted-foreground flex items-center gap-1"><HardDrive className="h-3 w-3" /> LOCAL.STORAGE</span>
          <span className="text-neon-cyan">PERSISTED</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-[34%] bg-gradient-to-r from-neon-cyan to-neon-violet animate-shimmer" />
        </div>
        <div className="flex items-center justify-between text-[10px] mono">
          <span className="text-muted-foreground flex items-center gap-1"><Database className="h-3 w-3" /> SNAPSHOTS</span>
          <span className="text-neon-lime">12 / 50</span>
        </div>
      </div>
    </div>
  );
};
