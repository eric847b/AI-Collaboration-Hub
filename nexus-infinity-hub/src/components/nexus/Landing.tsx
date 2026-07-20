import { useNexus } from "@/store/nexus";
import { Boxes, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Landing = ({ onEnter }: { onEnter: () => void }) => {
  const { workspace, resetWorkspace } = useNexus();
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
      <div className="max-w-3xl w-full glass-strong rounded-3xl p-10 animate-fade-in relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-neon-cyan/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-neon-violet/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <Boxes className="h-10 w-10 text-neon-cyan" />
              <div className="absolute inset-0 blur-xl bg-neon-cyan/40 animate-float" />
            </div>
            <div>
              <div className="text-[10px] mono tracking-[0.3em] text-neon-cyan uppercase">v.02.05.2026.1 · kernel online</div>
              <h1 className="text-5xl font-bold tracking-tight neon-text leading-none">Nexus Infinity Hub</h1>
            </div>
          </div>
          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            A unified AI operating environment for <span className="text-neon-cyan">automation</span>, <span className="text-neon-violet">scripting</span>, <span className="text-neon-magenta">prompt evolution</span>, signal experimentation and persistent memory — local-first, offline-capable, alive.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8 mono text-[10px] uppercase">
            {["Workspace Kernel","Modular Dashboard","Prompt Lab","Userscript IDE","Reactive Bus","AI Graph","Binary Inversion","Memory Vault"].map(f => (
              <div key={f} className="glass rounded-lg p-2 text-center text-neon-cyan/80">{f}</div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 mt-8">
            <Button onClick={onEnter} size="lg" className="bg-gradient-to-r from-neon-cyan to-neon-violet text-primary-foreground hover:opacity-90 shadow-[0_0_30px_hsl(var(--neon-cyan)/0.4)] gap-2">
              Load "{workspace.name}" <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => { resetWorkspace(); onEnter(); }} size="lg" variant="ghost" className="gap-2 border border-neon-violet/40 hover:bg-neon-violet/10 text-neon-violet">
              <Sparkles className="h-4 w-4" /> Forge New Workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
