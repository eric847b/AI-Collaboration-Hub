import { useEffect, useRef } from "react";
import { autonomousEngine } from "@/lib/autonomousEngine";
import type { EngineEvent } from "@/lib/autonomousEngine";

type EventCallback = (event: EngineEvent) => void;

export function useEngineEvents(callback: EventCallback) {
  const cbRef = useRef(callback);

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const unsubscribe = autonomousEngine.subscribeEvent((event: EngineEvent) => {
      cbRef.current(event);
    });
    return () => unsubscribe();
  }, []);
}
