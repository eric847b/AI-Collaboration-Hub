import { useState, DragEvent } from "react";
import { useNexus } from "@/store/nexus";
import { Folder, FileText, Trash2, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const FileVault = () => {
  const { workspace, addFile, removeFile } = useNexus();
  const [folder, setFolder] = useState("all");
  const folders = ["all", ...Array.from(new Set(workspace.files.map(f => f.folder)))];
  const filtered = folder === "all" ? workspace.files : workspace.files.filter(f => f.folder === folder);
  const [drag, setDrag] = useState(false);

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault(); setDrag(false);
    const files = Array.from(e.dataTransfer.files);
    for (const f of files) {
      const content = await f.text().catch(() => "");
      addFile({ id: `f_${Date.now()}_${f.name}`, name: f.name, folder: "uploads", size: f.size, type: f.name.split(".").pop() || "bin", content, ts: Date.now() });
    }
    toast.success(`${files.length} file(s) added`);
  };

  const download = (f: typeof workspace.files[0]) => {
    const blob = new Blob([f.content], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = f.name; a.click();
  };

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-3 glass-strong rounded-xl p-3">
        <h3 className="text-xs mono uppercase text-neon-cyan mb-2">Folders</h3>
        <div className="space-y-1">
          {folders.map(f => (
            <button key={f} onClick={() => setFolder(f)}
              className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs mono transition ${folder === f ? "bg-neon-cyan/10 text-neon-cyan" : "text-muted-foreground hover:bg-muted"}`}>
              <Folder className="h-3.5 w-3.5" /> {f}
              <span className="ml-auto text-[10px]">{f === "all" ? workspace.files.length : workspace.files.filter(x => x.folder === f).length}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-9 flex flex-col gap-3">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={`glass-strong rounded-xl p-6 border-dashed transition flex items-center justify-center gap-3 ${drag ? "border-neon-cyan shadow-[0_0_30px_hsl(var(--neon-cyan)/0.3)]" : ""}`}
          style={{ borderStyle: "dashed" }}
        >
          <Upload className={`h-6 w-6 ${drag ? "text-neon-cyan" : "text-muted-foreground"}`} />
          <div>
            <div className="text-sm">Drop files anywhere — scripts, JSON configs, templates</div>
            <div className="text-[10px] mono text-muted-foreground">Stored locally · IndexedDB-backed</div>
          </div>
        </div>
        <div className="glass-strong rounded-xl p-3 flex-1 overflow-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
            {filtered.map(f => (
              <div key={f.id} className="glass rounded-lg p-3 group hover:border-neon-cyan/40 transition">
                <div className="flex items-start justify-between">
                  <FileText className="h-4 w-4 text-neon-cyan" />
                  <span className="text-[9px] mono px-1.5 py-0.5 rounded bg-muted uppercase">{f.type}</span>
                </div>
                <div className="text-xs font-semibold mt-2 truncate">{f.name}</div>
                <div className="text-[10px] mono text-muted-foreground">{f.folder} · {f.size}b</div>
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => download(f)}><Download className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFile(f.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
