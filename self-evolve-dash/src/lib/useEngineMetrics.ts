import { useEffect, useState } from "react";
import { autonomousEngine } from "@/lib/autonomousEngine";
import type { AutonomousState } from "@/lib/autonomousEngine";

interface EngineMetricsSnapshot {
  phase: AutonomousState["currentPhase"];
  successRate: number;
  throughput: number;
  generation: number;
  bestFitness: number;
  cycleCount: number;
  successCount: number;
  failureCount: number;
}

export function useEngineMetrics(): EngineMetricsSnapshot {
  const [metrics, setMetrics] = useState<EngineMetricsSnapshot>(() => {
    const s = autonomousEngine.getState();
    return {
      phase: s.currentPhase,
      successRate: s.predictedSuccessRate,
      throughput: s.throughput,
      generation: s.generation,
      bestFitness: s.bestFitness,
      cycleCount: s.cycleCount,
      successCount: s.successCount,
      failureCount: s.failureCount
    };
  });

  useEffect(() => {
    const unsub = autonomousEngine.subscribe((s) => {
      setMetrics({
        phase: s.currentPhase,
        successRate: s.predictedSuccessRate,
        throughput: s.throughput,
        generation: s.generation,
        bestFitness: s.bestFitness,
        cycleCount: s.cycleCount,
        successCount: s.successCount,
        failureCount: s.failureCount
      });
    });
    return () => unsub();
  }, []);

  return metrics;
}
