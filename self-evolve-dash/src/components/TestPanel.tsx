import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cacheManager } from "@/lib/cacheManager";
import { providerScorer } from "@/lib/providerScorer";
import { Beaker, Zap, Shuffle, AlertTriangle } from "lucide-react";

interface LogEvent {
  time: string;
  message: string;
  kind: "info" | "success" | "warn" | "error";
}

interface TestResult {
  prompt: string;
  response: string;
  provider: string;
  cacheStatus: "hit" | "miss";
}

const PROVIDERS = ["backend-edge", "backend-apply", "local-fallback"];

export const TestPanel = () => {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<TestResult | null>(null);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [cacheHits, setCacheHits] = useState(0);
  const [cacheMisses, setCacheMisses] = useState(0);
  const [busy, setBusy] = useState(false);

  const log = (message: string, kind: LogEvent["kind"] = "info") => {
    const entry = { time: new Date().toLocaleTimeString(), message, kind };
    console.log(`[TestPanel] ${message}`);
    setLogs((prev) => [entry, ...prev].slice(0, 10));
  };

  const runPrompt = async (p: string, opts: { forceFail?: string } = {}): Promise<TestResult> => {
    const cacheKey = `test:${p}`;
    const cached = cacheManager.get<TestResult>(cacheKey);
    if (cached) {
      setCacheHits((n) => n + 1);
      log(`CACHE HIT for "${p}" (provider=${cached.provider})`, "success");
      const hit = { ...cached, cacheStatus: "hit" as const };
      return hit;
    }
    setCacheMisses((n) => n + 1);
    log(`CACHE MISS for "${p}" — selecting provider`, "info");

    const candidates = PROVIDERS.filter((c) => c !== opts.forceFail);
    const selected = providerScorer.selectBest(candidates) || candidates[0];
    log(`Selected provider: ${selected}`, "info");

    const start = performance.now();
    try {
      // Simulate work using existing router/cache logic only
      await new Promise((r) => setTimeout(r, 150));
      if (opts.forceFail && selected === opts.forceFail) {
        throw new Error(`Simulated failure on ${selected}`);
      }
      const latency = performance.now() - start;
      providerScorer.recordSuccess(selected, latency);
      const res: TestResult = {
        prompt: p,
        response: `Echo: "${p}" (handled by ${selected})`,
        provider: selected,
        cacheStatus: "miss",
      };
      cacheManager.set(cacheKey, res);
      log(`SUCCESS via ${selected} in ${Math.round(latency)}ms`, "success");
      return res;
    } catch (e) {
      providerScorer.recordFailure(selected);
      log(`FAILURE on ${selected}: ${(e as Error).message}`, "error");
      throw e;
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const res = await runPrompt(prompt.trim());
      setResult(res);
    } catch (e) {
      log(`Submit failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const testCache = async () => {
    const p = prompt.trim() || "cache-test-prompt";
    setBusy(true);
    log(`--- TEST CACHE: running "${p}" twice ---`, "info");
    try {
      const r1 = await runPrompt(p);
      const r2 = await runPrompt(p);
      setResult(r2);
      log(`Run 1: ${r1.cacheStatus}, Run 2: ${r2.cacheStatus}`, "success");
    } catch (e) {
      log(`Cache test failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const testRouting = () => {
    log(`--- TEST ROUTING ---`, "info");
    providerScorer.logScores();
    const scores = providerScorer.getAllScores();
    Object.entries(scores).forEach(([name, { score }]) => {
      log(`Provider ${name}: score=${score.toFixed(4)}`, "info");
    });
    const selected = providerScorer.selectBest(PROVIDERS);
    log(`Selected best: ${selected ?? "none"}`, "success");
  };

  const testFailover = async () => {
    setBusy(true);
    const p = prompt.trim() || "failover-test";
    log(`--- TEST FAILOVER ---`, "info");
    const target = providerScorer.selectBest(PROVIDERS) || PROVIDERS[0];
    log(`Forcing failure on ${target}`, "warn");
    // Trigger failures to engage circuit breaker
    for (let i = 0; i < 2; i++) {
      try {
        await runPrompt(`${p}-fail-${i}`, { forceFail: target });
      } catch {
        /* expected */
      }
    }
    log(`Now retrying without forced failure → expect fallback`, "info");
    try {
      const res = await runPrompt(`${p}-recover`);
      setResult(res);
      log(`Failover landed on: ${res.provider}`, "success");
    } catch (e) {
      log(`Failover failed: ${(e as Error).message}`, "error");
    } finally {
      setBusy(false);
    }
  };

  const scores = providerScorer.getAllScores();

  return (
    <Card className="glass-effect">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-accent" />
          Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Enter test prompt..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            disabled={busy}
          />
          <Button onClick={handleSubmit} disabled={busy || !prompt.trim()}>
            Submit
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" onClick={testCache} disabled={busy}>
            <Zap className="h-4 w-4 mr-1" /> Test Cache
          </Button>
          <Button variant="outline" onClick={testRouting} disabled={busy}>
            <Shuffle className="h-4 w-4 mr-1" /> Test Routing
          </Button>
          <Button variant="outline" onClick={testFailover} disabled={busy}>
            <AlertTriangle className="h-4 w-4 mr-1" /> Test Failover
          </Button>
        </div>

        {result && (
          <div className="p-3 rounded-md border border-border bg-muted/30 space-y-1 text-sm">
            <div className="flex gap-2 items-center flex-wrap">
              <Badge variant="outline">Provider: {result.provider}</Badge>
              <Badge
                className={
                  result.cacheStatus === "hit"
                    ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                }
              >
                Cache: {result.cacheStatus.toUpperCase()}
              </Badge>
            </div>
            <div className="text-muted-foreground text-xs">Prompt: {result.prompt}</div>
            <div className="font-mono text-xs">{result.response}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-md border border-border bg-muted/20">
            <div className="font-semibold mb-1">Cache</div>
            <div>Hits: <span className="text-accent">{cacheHits}</span></div>
            <div>Misses: <span className="text-muted-foreground">{cacheMisses}</span></div>
          </div>
          <div className="p-3 rounded-md border border-border bg-muted/20">
            <div className="font-semibold mb-1">Providers</div>
            {Object.keys(scores).length === 0 && (
              <div className="text-muted-foreground">No data yet</div>
            )}
            {Object.entries(scores).map(([name, { metrics }]) => (
              <div key={name} className="flex justify-between gap-2">
                <span className="truncate">{name}</span>
                <span>
                  <span className="text-accent">{metrics.successCount}✓</span>{" "}
                  <span className="text-destructive">{metrics.failureCount}✗</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold mb-1">Recent Events (last 10)</div>
          <ScrollArea className="h-40 rounded-md border border-border p-2">
            {logs.length === 0 && (
              <div className="text-xs text-muted-foreground">No events yet</div>
            )}
            <ul className="space-y-1">
              {logs.map((l, i) => (
                <li key={i} className="text-xs font-mono flex gap-2">
                  <span className="text-muted-foreground shrink-0">{l.time}</span>
                  <span
                    className={
                      l.kind === "success"
                        ? "text-accent"
                        : l.kind === "error"
                        ? "text-destructive"
                        : l.kind === "warn"
                        ? "text-yellow-500"
                        : "text-foreground"
                    }
                  >
                    {l.message}
                  </span>
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
