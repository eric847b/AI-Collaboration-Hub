import { supabase } from "@/integrations/supabase/client";
import { cacheManager } from "./cacheManager";

interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
}

/**
 * Execute a function with exponential backoff retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoffMultiplier = 2 } = options;
  
  let lastError: Error | null = null;
  let delay = delayMs;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt}/${maxAttempts} failed:`, error);
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= backoffMultiplier;
      }
    }
  }
  
  throw lastError || new Error('Retry failed');
}

/**
 * Check if Supabase backend is accessible
 */
export async function checkBackendHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    const { error } = await supabase
      .from('scripts')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    const latency = Date.now() - startTime;
    
    if (error) {
      return { healthy: false, error: error.message, latency };
    }
    
    return { healthy: true, latency };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Connection failed',
      latency: Date.now() - startTime
    };
  }
}

/**
 * Safe database query with error handling, retry, and caching
 */
export async function safeQuery<T>(
  queryFn: () => any,
  defaultValue: T,
  options?: RetryOptions & { cacheKey?: string; cacheTTL?: number }
): Promise<T> {
  // Try cache first if key provided
  if (options?.cacheKey) {
    const cached = cacheManager.get<T>(options.cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  try {
    const result = await withRetry(async () => {
      const queryBuilder = queryFn();
      const { data, error } = await queryBuilder;
      if (error) throw error;
      return data;
    }, options);
    
    const finalResult = result ?? defaultValue;

    // Cache successful result
    if (options?.cacheKey && result !== null) {
      cacheManager.set(options.cacheKey, finalResult, options.cacheTTL);
    }

    return finalResult;
  } catch (error) {
    console.error('Query failed after retries:', error);
    return defaultValue;
  }
}

/**
 * Safe edge function invocation with error handling and caching
 */
export async function safeInvoke<T = any>(
  functionName: string,
  body: any,
  options?: RetryOptions & { cacheKey?: string; cacheTTL?: number }
): Promise<{ data: T | null; error: string | null }> {
  // Try cache first if key provided
  if (options?.cacheKey) {
    const cached = cacheManager.get<T>(options.cacheKey);
    if (cached !== null) {
      return { data: cached, error: null };
    }
  }

  try {
    const result = await withRetry(async () => {
      const { data, error } = await supabase.functions.invoke(functionName, { body });
      if (error) throw error;
      return data;
    }, options);
    
    // Cache successful result
    if (options?.cacheKey && result !== null) {
      cacheManager.set(options.cacheKey, result, options.cacheTTL);
    }

    return { data: result, error: null };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Function ${functionName} failed:`, error);
    return { data: null, error: errorMessage };
  }
}

/**
 * Parse and format error messages for user display
 */
export function formatErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';
  
  // Connection errors
  if (error.message?.includes('Load failed') || error.message?.includes('Failed to fetch')) {
    return '⚠️ Backend connection lost. Please check your internet connection or try again later.';
  }
  
  // Timeout errors
  if (error.message?.includes('timeout') || error.code === '544') {
    return '⏱️ Request timed out. The backend may be experiencing high load. Please try again.';
  }
  
  // Function errors
  if (error.name === 'FunctionsFetchError') {
    return '🔌 Unable to reach backend services. The system may be temporarily unavailable.';
  }
  
  // Generic error
  return error.message || 'An error occurred. Please try again.';
}

/**
 * Check if error is a connection/network error
 */
export function isConnectionError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('load failed') ||
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('connection') ||
    message.includes('timeout') ||
    error.name === 'FunctionsFetchError'
  );
}
