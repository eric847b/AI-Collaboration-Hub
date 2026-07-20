import { useState, useCallback, useRef } from 'react';

/**
 * Optimized state hook with debouncing and batching capabilities
 */
export function useOptimizedState<T>(
  initialValue: T,
  debounceMs: number = 0
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [state, setState] = useState<T>(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const setOptimizedState = useCallback((value: T | ((prev: T) => T)) => {
    if (debounceMs > 0) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setState(value);
      }, debounceMs);
    } else {
      setState(value);
    }
  }, [debounceMs]);

  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  }, []);

  return [state, setOptimizedState, flush];
}
