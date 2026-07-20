import { useEffect, DependencyList } from 'react';

/**
 * useEffect hook that handles async operations safely
 */
export function useAsyncEffect(
  effect: () => Promise<void | (() => void)>,
  deps: DependencyList
) {
  useEffect(() => {
    let isMounted = true;
    let cleanup: void | (() => void);

    const executeEffect = async () => {
      try {
        cleanup = await effect();
      } catch (error) {
        if (isMounted) {
          console.error('Async effect error:', error);
        }
      }
    };

    executeEffect();

    return () => {
      isMounted = false;
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, deps);
}
