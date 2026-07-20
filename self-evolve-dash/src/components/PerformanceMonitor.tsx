import { useEffect, useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, Database, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PerformanceMetrics {
  fps: number;
  memory: number;
  apiLatency: number;
  renderTime: number;
}

export const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 60,
    memory: 0,
    apiLatency: 0,
    renderTime: 0
  });

  const [isVisible, setIsVisible] = useState(false);

  // Track render time
  const lastRender = useRef(performance.now());

  useEffect(() => {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const renderEntry = entries.find((e) => e.entryType === "measure");
      if (renderEntry) {
        setMetrics((prev) => ({
          ...prev,
          renderTime: Math.round(renderEntry.duration)
        }));
      }
    });

    try {
      observer.observe({ entryTypes: ["measure"] });
    } catch {
      // Some browsers don't support this — safe to ignore
    }

    return () => observer.disconnect();
  }, []);

  // Toggle visibility with Ctrl+Shift+P
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "p") {
        setIsVisible((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  // FPS + Memory + Render Time Loop
  useEffect(() => {
    if (!isVisible) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let animationFrameId: number;

    const loop = () => {
      frameCount++;

      const now = performance.now();
      const delta = now - lastTime;

      // Update every second
      if (delta >= 1000) {
        const fps = Math.round((frameCount * 1000) / delta);

        // Memory usage (Chrome only)
        const memory =
          (performance as any).memory?.usedJSHeapSize
            ? Math.round(((performance as any).memory.usedJSHeapSize / 1048576) * 100) / 100
            : 0;

        // Render time measurement
        const renderStart = performance.now();
        try { performance.measure("render", { start: lastRender.current, end: renderStart } as any); } catch {}
        lastRender.current = renderStart;

        setMetrics((prev) => ({
          ...prev,
          fps,
          memory
        }));

        frameCount = 0;
        lastTime = now;
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrameId);
  }, [isVisible]);

  // API Latency Sampler (non-blocking)
  useEffect(() => {
    if (!isVisible) return;

    let interval = setInterval(async () => {
      const start = performance.now();
      try {
        await fetch("/api/health").catch(() => null);
      } catch {
        // ignore
      }
      const latency = Math.round(performance.now() - start);

      setMetrics((prev) => ({
        ...prev,
        apiLatency: latency
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const getPerformanceColor = (value: number, thresholds: [number, number]) => {
    if (value >= thresholds[0]) return "text-success";
    if (value >= thresholds[1]) return "text-warning";
    return "text-destructive";
  };

  return (
    <Card className="fixed bottom-4 right-4 p-4 glass-effect border-accent/30 w-80 z-50 animate-fade-in shadow-xl">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-accent animate-pulse" />
            <h3 className="font-semibold text-sm">Performance Monitor</h3>
          </div>
          <Badge variant="outline" className="text-xs">
            Ctrl+Shift+P
          </Badge>
        </div>

        {/* FPS */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3" />
              <span>FPS</span>
            </div>
            <span
              className={`font-mono font-semibold ${getPerformanceColor(
                metrics.fps,
                [50, 30]
              )}`}
            >
              {metrics.fps}
            </span>
          </div>
          <Progress value={(metrics.fps / 60) * 100} className="h-1" />
        </div>

        {/* Memory */}
        {metrics.memory > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Database className="h-3 w-3" />
                <span>Memory</span>
              </div>
              <span className="font-mono font-semibold">{metrics.memory} MB</span>
            </div>
            <Progress value={Math.min((metrics.memory / 100) * 100, 100)} className="h-1" />
          </div>
        )}

        {/* API Latency */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>API Latency</span>
            </div>
            <span
              className={`font-mono font-semibold ${getPerformanceColor(
                metrics.apiLatency,
                [200, 500]
              )}`}
            >
              {metrics.apiLatency} ms
            </span>
          </div>
          <Progress
            value={Math.min((metrics.apiLatency / 500) * 100, 100)}
            className="h-1"
          />
        </div>

        {/* Render Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3" />
              <span>Render Time</span>
            </div>
            <span className="font-mono font-semibold">{metrics.renderTime} ms</span>
          </div>
          <Progress
            value={Math.min((metrics.renderTime / 16) * 100, 100)}
            className="h-1"
          />
        </div>

        <div className="pt-2 border-t border-border text-xs text-muted-foreground">
          Updated every second
        </div>
      </div>
    </Card>
  );
};
