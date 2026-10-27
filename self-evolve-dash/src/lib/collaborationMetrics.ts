export interface CollaborationResource { id: string; status?: string; remaining: number | null; quota: number | null; hours_to_refill: number | null; confidence?: string; score?: number; schedulable?: boolean; }
export interface CollaborationMetrics { schema: string; generated_at: string; summary?: Record<string, number | null>; providers?: { id: string; status: string; configured: boolean }[]; collaboration?: { runs?: number; provider_calls?: number; tokens_reported?: number }; provider_tally?: Record<string, { calls?: number; successes?: number; failures?: number; usage_reports?: number; input_tokens?: number; output_tokens?: number; total_tokens?: number }>; rankings_by_task?: Record<string, CollaborationResource[]>; policy?: { free_only?: boolean }; renewal_policy?: string; }
export const COLLABORATION_METRICS_URL = "https://eric847b.github.io/autonomous-github-agent/profile-snapshot.json";
export async function fetchCollaborationMetrics(signal?: AbortSignal): Promise<CollaborationMetrics> {
 const response = await fetch(COLLABORATION_METRICS_URL + "?t=" + Date.now(), { cache: "no-store", signal, headers: { Accept: "application/json" } });
 if (!response.ok) throw new Error("Fleet metrics request failed: HTTP " + response.status);
 const data: unknown = await response.json();
 if (!data || typeof data !== "object") throw new Error("Fleet metrics response is not an object");
 const metrics = (data as Record<string, unknown>).collaboration_metrics as CollaborationMetrics | undefined;
 if (!metrics || metrics.schema !== "aga.collaboration-metrics.v1" || typeof metrics.generated_at !== "string") throw new Error("Fleet metrics contract is missing or unsupported");
 return metrics;
}
