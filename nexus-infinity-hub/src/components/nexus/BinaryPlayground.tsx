import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeftRight } from "lucide-react";

const toBin = (s: string) => s.split("").map(c => c.charCodeAt(0).toString(2).padStart(8, "0")).join(" ");
const invertBin = (b: string) => b.split("").map(c => c === "1" ? "0" : c === "0" ? "1" : c).join("");
const fromBin = (b: string) => b.split(" ").map(x => String.fromCharCode(parseInt(x, 2))).join("");

export const BinaryPlayground = () => {
  const [input, setInput] = useState("NEXUS");
  const [inverted, setInverted] = useState(false);
  const original = toBin(input);
  const flipped = invertBin(original);
  const stream = inverted ? flipped : original;
  const decoded = inverted ? fromBin(flipped) : input;
  const delta = original.split("").filter((c, i) => c !== flipped[i]).length;

  return (
    <div className="grid grid-cols-12 gap-3 h-full">
      <div className="col-span-4 glass-strong rounded-xl p-3 flex flex-col">
        <h3 className="text-xs mono uppercase text-neon-magenta mb-2">Input</h3>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 mono text-sm resize-none bg-background/40" />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] mono text-muted-foreground">{input.length} chars · {input.length * 8} bits</span>
          <Button size="sm" onClick={() => setInverted(i => !i)} className="h-7 gap-1 bg-neon-magenta/20 text-neon-magenta hover:bg-neon-magenta/30">
            <ArrowLeftRight className="h-3.5 w-3.5" /> {inverted ? "INVERTED" : "NORMAL"}
          </Button>
        </div>
      </div>

      <div className="col-span-8 glass-strong rounded-xl p-3 flex flex-col gap-3">
        <div>
          <h4 className="text-[10px] mono uppercase text-neon-cyan mb-1">Bit Stream {inverted && "(inverted)"}</h4>
          <div className="mono text-[11px] bg-background/60 rounded p-2 break-all max-h-32 overflow-auto leading-relaxed">
            {stream.split(" ").map((byte, i) => (
              <span key={i} className="inline-block mr-2">
                {byte.split("").map((b, j) => (
                  <span key={j} className={b === "1" ? "text-neon-cyan" : "text-muted-foreground"}>{b}</span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="glass rounded-lg p-3">
            <div className="text-[10px] mono uppercase text-muted-foreground">Decoded</div>
            <div className="text-sm mono text-neon-lime mt-1 break-all">{decoded || "—"}</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="text-[10px] mono uppercase text-muted-foreground">Δ Delta Bits</div>
            <div className="text-2xl mono font-bold text-neon-magenta">{delta}</div>
          </div>
          <div className="glass rounded-lg p-3">
            <div className="text-[10px] mono uppercase text-muted-foreground">Entropy</div>
            <div className="text-2xl mono font-bold text-neon-violet">{(delta / (original.replace(/ /g, "").length || 1)).toFixed(3)}</div>
          </div>
        </div>
        <div>
          <h4 className="text-[10px] mono uppercase text-neon-violet mb-1">Stream Comparison</h4>
          <div className="space-y-1 mono text-[10px]">
            <div className="flex gap-2"><span className="text-muted-foreground w-12">A:</span><span className="text-neon-cyan break-all">{original}</span></div>
            <div className="flex gap-2"><span className="text-muted-foreground w-12">¬A:</span><span className="text-neon-magenta break-all">{flipped}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};
