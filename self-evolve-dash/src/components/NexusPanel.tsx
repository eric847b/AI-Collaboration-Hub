import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Power, Trash2, Network } from "lucide-react";
import { nexusStore, useNexusStore } from "@/lib/nexus/store";
import { rankProviders } from "@/lib/nexus/scoring";
import type { AIProvider } from "@/lib/nexus/types";

const sampleProviders: AIProvider[] = [
  { id: "lovable-ai", name: "Lovable AI", costType: "free", available: true, latencyMs: 420, successRate: 0.97 },
  { id: "openai", name: "OpenAI Direct", costType: "paid", available: true, latencyMs: 380, successRate: 0.99 },
  { id: "local", name: "Local Fallback", costType: "free", available: true, latencyMs: 90, successRate: 0.78 },
];

export const NexusPanel = () => {
  const { modules, queue } = useNexusStore();
  const ranked = rankProviders(sampleProviders);

  return (
    <div className="space-y-6">
      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Nexus Modules
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {modules.map((m) => (
            <div
              key={m.id}
              className="rounded-xl border border-border bg-card/60 p-4 hover-lift"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold flex items-center gap-2">
                    {m.name}
                    <Badge variant="outline" className="text-[10px]">
                      v{m.version}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
                </div>
                <Badge
                  className={
                    m.status === "online" || m.status === "running"
                      ? "bg-accent/20 text-accent"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {m.status}
                </Badge>
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => nexusStore.runModule(m.id)}>
                  <Play className="h-3 w-3 mr-1" /> Run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => nexusStore.toggleModule(m.id)}>
                  <Power className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Job Queue</span>
            <Button size="sm" variant="ghost" onClick={() => nexusStore.clearDone()}>
              <Trash2 className="h-3 w-3 mr-1" /> Clear done
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {queue.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs queued.</p>
          ) : (
            <ul className="space-y-2">
              {queue.map((j) => (
                <li
                  key={j.id}
                  className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2"
                >
                  <span>{j.label}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{j.status}</Badge>
                    {j.status === "running" && (
                      <Button size="sm" variant="ghost" onClick={() => nexusStore.completeJob(j.id)}>
                        Complete
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="glass-effect">
        <CardHeader>
          <CardTitle>Smart Provider Routing</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {ranked.map((s, i) => (
              <li
                key={s.provider.id}
                className="flex items-center justify-between text-sm border border-border rounded-md px-3 py-2"
              >
                <span className="flex items-center gap-2">
                  <Badge className={i === 0 ? "bg-primary text-primary-foreground" : ""}>
                    #{i + 1}
                  </Badge>
                  {s.provider.name}
                  <span className="text-xs text-muted-foreground">({s.provider.costType})</span>
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  score {s.finalScore.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};