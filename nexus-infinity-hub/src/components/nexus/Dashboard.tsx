import { useEffect, useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { useNexus, type Widget } from "@/store/nexus";
import { KernelWidget } from "./widgets/KernelWidget";
import { EventsWidget } from "./widgets/EventsWidget";
import { SignalsWidget } from "./widgets/SignalsWidget";
import { MemoryWidget } from "./widgets/MemoryWidget";
import { RemoteWidget } from "./widgets/RemoteWidget";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const widgetMap: Record<string, { title: string; comp: () => JSX.Element }> = {
  kernel: { title: "Workspace Kernel", comp: KernelWidget },
  events: { title: "Reactive Event Bus", comp: EventsWidget },
  signals: { title: "Signal Monitor", comp: SignalsWidget },
  memory: { title: "Memory Stream", comp: MemoryWidget },
  remote: { title: "AI Remote", comp: RemoteWidget },
};

export const Dashboard = () => {
  const { workspace, setLayout } = useNexus();
  const [layout, setLocal] = useState<Widget[]>(workspace.layout);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocal(workspace.layout); }, [workspace.layout]);

  const update = (w: Widget) => {
    const next = layout.map(x => x.id === w.id ? w : x);
    setLocal(next); setLayout(next);
  };
  const remove = (id: string) => {
    const next = layout.filter(x => x.id !== id);
    setLocal(next); setLayout(next);
  };
  const add = (type: string) => {
    const w: Widget = { id: `w_${Date.now()}`, type, x: 40, y: 40, w: 380, h: 240 };
    const next = [...layout, w];
    setLocal(next); setLayout(next);
  };

  return (
    <div className="relative w-full h-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Modular Dashboard</h1>
          <p className="text-xs mono text-muted-foreground">Drag · Resize · Dock — layout persists locally</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 border-neon-cyan/40 text-neon-cyan hover:bg-neon-cyan/10">
              <Plus className="h-3.5 w-3.5" /> Add Widget
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="glass-strong">
            {Object.entries(widgetMap).map(([k, v]) => (
              <DropdownMenuItem key={k} onClick={() => add(k)}>{v.title}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div ref={containerRef} className="relative w-full h-[calc(100%-3rem)] overflow-auto rounded-xl border border-border/40 bg-background/30">
        <div className="relative" style={{ minWidth: 1280, minHeight: 720 }}>
          {layout.map((w) => {
            const W = widgetMap[w.type];
            if (!W) return null;
            const Comp = W.comp;
            return (
              <Rnd
                key={w.id}
                size={{ width: w.w, height: w.h }}
                position={{ x: w.x, y: w.y }}
                bounds="parent"
                minWidth={260}
                minHeight={160}
                onDragStop={(_, d) => update({ ...w, x: d.x, y: d.y })}
                onResizeStop={(_, __, ref, ___, pos) => update({ ...w, w: ref.offsetWidth, h: ref.offsetHeight, x: pos.x, y: pos.y })}
                dragHandleClassName="widget-drag"
                className="z-10"
              >
                <div className="glass-strong h-full w-full rounded-xl flex flex-col overflow-hidden animate-scale-in">
                  <div className="widget-drag flex items-center justify-between px-3 py-2 border-b border-border/40 cursor-move bg-gradient-to-r from-neon-cyan/5 to-transparent">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-neon-cyan shadow-[0_0_6px_hsl(var(--neon-cyan))]" />
                      <span className="text-xs mono uppercase tracking-wider text-neon-cyan">{W.title}</span>
                    </div>
                    <button onClick={() => remove(w.id)} className="text-muted-foreground hover:text-destructive transition">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-3"><Comp /></div>
                </div>
              </Rnd>
            );
          })}
        </div>
      </div>
    </div>
  );
};
