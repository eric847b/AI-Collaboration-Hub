import { useEffect, useState, useCallback } from "react";
import { autonomousEngine } from "@/lib/autonomousEngine";
import type { AutonomousState, EngineEvent } from "@/lib/autonomousEngine";

export function useAutonomousEngine() {
  const [state, setState] = useState<AutonomousState>(
    autonomousEngine.getState()
  );

  // Subscribe once, sync immediately, auto‑cleanup
  useEffect(() => {
    const unsubscribe = autonomousEngine.subscribe(setState);
    return () => unsubscribe();
  }, []);

  // Stable wrappers around engine actions
  const start = useCallback(() => {
    autonomousEngine.start();
  }, []);

  const stop = useCallback(() => {
    autonomousEngine.stop();
  }, []);

  const dispatch = useCallback((event: EngineEvent) => {
    autonomousEngine.dispatch(event);
  }, []);

  return {
    state,
    start,
    stop,
    dispatch,
    // convenience flags
    isRunning: state.isRunning,
    phase: state.currentPhase,
    metrics: {
      successRate: state.predictedSuccessRate,
      throughput: state.throughput,
      generation: state.generation,
      bestFitness: state.bestFitness
    }
  };
}
