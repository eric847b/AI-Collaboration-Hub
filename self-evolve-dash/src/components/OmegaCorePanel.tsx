import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Atom, Zap, GitMerge } from "lucide-react";
import { SEED_KERNEL, sandboxExec, evolveOnce, buildGenome, type Genome, type Generation } from "@/lib/omega/evolution";
import { Ω } from "@/lib/omega/runtime";
import { diffLines } from "@/lib/omega/diff";
import { useToast } from "@/hooks/use-toast";

export const OmegaCorePanel = () => {
  const { toast } = useToast();
  const [code, setCode] = useState(SEED_KERNEL);
  const [parent, setParent] = useState<Genome | null>(null);
  const [gen, setGen] = useState<Generation | null>(null);
  const [runtimeStats, setRuntimeStats] = useState(Ω.history.slice(-1)[0] ?? null);

  const seed = () => {
    const exec = sandboxExec(code);
    const g = buildGenome({
      code,
      baselineHash: exec.hash,
      baselineSize: code.length,
      baselineMs: exec.ms,
      mutations: [],
      generation: 0,
    });
    setParent(g);
    setGen(null);
    toast({ title: "Ω∞ Kernel Seeded", description: `size=${g.size} fit=${g.fitness}` });
  };

  const evolveStep = () => {
    if (!parent) return seed();
    const exec = sandboxExec(parent.code);
    const next = evolveOnce(parent, exec.hash, parent.size, exec.ms, (gen?.index ?? 0) + 1);
    setGen(next);
    if (next.best.fitness > parent.fitness) setParent(next.best);
    toast({
      title: `Generation ${next.index}`,
      description: `improvement ${next.improvement}% · best fit ${next.best.fitness}`,
    });
  };

  const runRuntimeEvolve = () => {
    const snap = Ω.evolve();
    setRuntimeStats(snap);
    toast({ title: "ΩCore runtime evolved", description: `dedup ${(snap.dedupRate * 100).toFixed(1)}%` });
  };

  const diff = parent && gen ? diffLines(parent.code, gen.best.code).slice(0, 40) : [];

  return (
    <div className="space-y-6">
      <Card className="p-6 glass-effect border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <Atom className="h-6 w-6 text-primary animate-glow-pulse" />
          <div>
            <h2 className="text-2xl font-bold text-gradient">Ω∞ Compression Core</h2>
            <p className="text-sm text-muted-foreground">Competitive evolution: mutate → sandbox → score → keep best</p>
          </div>
        </div>

        <Textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />

        <div className="flex gap-2 mt-4">
          <Button onClick={seed} variant="outline" className="hover-lift">
            <Zap className="mr-2 h-4 w-4" /> Seed Kernel
          </Button>
          <Button onClick={evolveStep} className="gradient-primary hover-lift" disabled={!parent}>
            <GitMerge className="mr-2 h-4 w-4" /> Evolve One Generation
          </Button>
        </div>

        {parent && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">size {parent.size}</Badge>
            <Badge variant="outline">fit {parent.fitness}</Badge>
            <Badge variant="outline">gen {parent.generation}</Badge>
            <Badge variant="outline">{parent.checksum}</Badge>
          </div>
        )}

        {gen && (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-semibold">
              Generation {gen.index} · {gen.candidates.length} candidates · best fit {gen.best.fitness} · {gen.improvement}% smaller
            </p>
            <div className="rounded-md border border-border/50 bg-muted/30 p-3 max-h-64 overflow-auto font-mono text-xs">
              {diff.map((d, i) => (
                <div
                  key={i}
                  className={
                    d.type === "add"
                      ? "text-success"
                      : d.type === "del"
                      ? "text-destructive line-through opacity-70"
                      : "text-muted-foreground"
                  }
                >
                  {d.type === "add" ? "+ " : d.type === "del" ? "- " : "  "}
                  {d.text}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6 glass-effect border-accent/20">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xl font-bold text-gradient">ΩCore Runtime</h3>
            <p className="text-xs text-muted-foreground">Persistent dedup pool · v{Ω.version}</p>
          </div>
          <Button size="sm" onClick={runRuntimeEvolve} variant="outline" className="hover-lift">
            Evolve Runtime
          </Button>
        </div>
        {runtimeStats && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">modules {runtimeStats.modules}</Badge>
            <Badge variant="outline">unique fns {runtimeStats.uniqueFns}</Badge>
            <Badge variant="outline">total fns {runtimeStats.totalFns}</Badge>
            <Badge variant="outline">dedup {(runtimeStats.dedupRate * 100).toFixed(1)}%</Badge>
            <Badge variant="outline">size {runtimeStats.size}b</Badge>
          </div>
        )}
      </Card>
    </div>
  );
};