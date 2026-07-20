import { useNexus } from "@/store/nexus";
import { Activity, Boxes, Brain, Cpu, FileCode2, FolderArchive, GitBranch, LayoutDashboard, Radio, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const modules = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "prompts", label: "Prompt Lab", icon: Sparkles },
  { id: "scripts", label: "Userscripts", icon: FileCode2 },
  { id: "events", label: "Event Bus", icon: Radio },
  { id: "graph", label: "AI Graph", icon: GitBranch },
  { id: "binary", label: "Binary Inv.", icon: Zap },
  { id: "remote", label: "AI Remote", icon: Cpu },
  { id: "memory", label: "Memory Vault", icon: Brain },
  { id: "files", label: "File Vault", icon: FolderArchive },
];

export const Sidebar = () => {
  const { activeModule, setModule, workspace } = useNexus();
  return (
    <aside className="glass-strong relative z-10 flex w-60 flex-col gap-1 rounded-2xl p-3 m-3 mr-0">
      <div className="px-2 pb-3 pt-2 border-b border-border/50 mb-2">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Boxes className="h-6 w-6 text-neon-cyan" />
            <div className="absolute inset-0 blur-md bg-neon-cyan/40" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight neon-text">NEXUS</div>
            <div className="text-[10px] mono text-muted-foreground tracking-widest">INFINITY HUB</div>
          </div>
        </div>
      </div>
      <div className="text-[10px] mono uppercase text-muted-foreground px-2 mt-1">Modules</div>
      <nav className="flex flex-col gap-1 mt-1 flex-1">
        {modules.map((m) => {
          const Icon = m.icon;
          const active = activeModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setModule(m.id)}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all relative",
                active
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 shadow-[0_0_20px_hsl(var(--neon-cyan)/0.3)]"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-neon-cyan border border-transparent"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{m.label}</span>
              {active && <div className="ml-auto pulse-dot" />}
            </button>
          );
        })}
      </nav>
      <div className="glass rounded-lg p-3 mt-2">
        <div className="flex items-center justify-between text-[10px] mono uppercase text-muted-foreground mb-1">
          <span>Workspace</span>
          <Activity className="h-3 w-3 text-neon-lime" />
        </div>
        <div className="text-xs font-semibold truncate">{workspace.name}</div>
        <div className="text-[10px] mono text-muted-foreground mt-1">
          {workspace.prompts.length}P · {workspace.scripts.length}S · {workspace.files.length}F
        </div>
      </div>
    </aside>
  );
};
