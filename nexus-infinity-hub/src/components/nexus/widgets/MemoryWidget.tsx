import { useNexus } from "@/store/nexus";
import { Clock } from "lucide-react";

export const MemoryWidget = () => {
  const { workspace } = useNexus();
  return (
    <div className="space-y-2">
      <div className="text-[10px] mono text-muted-foreground">RECENT_MEMORY :: timeline</div>
      {workspace.notes.slice(0, 5).map(n => (
        <div key={n.id} className="glass rounded-lg p-2 hover:border-neon-cyan/40 transition">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold truncate">{n.title}</div>
            <span className="text-[9px] mono text-neon-cyan uppercase">{n.tag}</span>
          </div>
          <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>
          <div className="text-[9px] mono text-muted-foreground/60 mt-1 flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> {new Date(n.ts).toLocaleString("en-GB")}
          </div>
        </div>
      ))}
    </div>
  );
};
