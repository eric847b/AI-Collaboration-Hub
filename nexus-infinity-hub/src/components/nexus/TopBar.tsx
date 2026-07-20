import { useNexus } from "@/store/nexus";
import { Download, Upload, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const TopBar = () => {
  const { workspace, importWorkspace, resetWorkspace } = useNexus();
  const [time, setTime] = useState("");
  const [saved, setSaved] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-GB")), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setSaved(Date.now());
  }, [workspace]);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nexus-${workspace.name.replace(/\s/g, "-")}.json`;
    a.click();
    toast.success("Workspace exported");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const f = target.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        importWorkspace(JSON.parse(text));
        toast.success("Workspace imported");
      } catch {
        toast.error("Invalid workspace file");
      }
    };
    input.click();
  };

  return (
    <header className="glass-strong relative z-10 flex items-center justify-between rounded-2xl px-4 py-2 m-3 mb-0">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="text-xs mono uppercase tracking-widest text-neon-cyan">Kernel Online</span>
        </div>
        <div className="hidden md:flex items-center gap-1.5 text-[10px] mono text-muted-foreground">
          <span className="text-neon-lime">●</span> AUTOSAVE {Math.floor((Date.now() - saved) / 1000)}s
        </div>
      </div>
      <div className="hidden md:block text-xs mono text-muted-foreground">
        nexus.infinity.hub <span className="text-neon-violet">::</span> {workspace.name}
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs mono text-neon-cyan w-20 text-right">{time}</div>
        <Button size="sm" variant="ghost" onClick={handleImport} className="h-8 gap-1.5"><Upload className="h-3.5 w-3.5" />Import</Button>
        <Button size="sm" variant="ghost" onClick={handleExport} className="h-8 gap-1.5"><Download className="h-3.5 w-3.5" />Export</Button>
        <Button size="sm" variant="ghost" onClick={() => { resetWorkspace(); toast("Workspace reset"); }} className="h-8 gap-1.5"><RotateCcw className="h-3.5 w-3.5" />Reset</Button>
      </div>
    </header>
  );
};
