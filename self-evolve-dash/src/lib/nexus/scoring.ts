import { AIProvider, CostType, ScoredProvider } from "./types";

const COST_BIAS: Record<CostType, number> = { free: 10, limited: 5, paid: -10 };
const CLOSE_SCORE_THRESHOLD = 5;

export function scoreProvider(provider: AIProvider): ScoredProvider {
  const successScore = provider.successRate * 50;
  const latencyScore = Math.max(0, 50 - provider.latencyMs / 100);
  const providerScore = successScore + latencyScore;
  const costBias = COST_BIAS[provider.costType];
  return { provider, providerScore, costBias, finalScore: providerScore + costBias };
}

export function rankProviders(providers: AIProvider[]): ScoredProvider[] {
  const scored = providers
    .filter((p) => p.available)
    .map(scoreProvider)
    .sort((a, b) => b.finalScore - a.finalScore);

  if (scored.length >= 2) {
    const top = scored[0];
    const diff = top.finalScore - scored[1].finalScore;
    if (diff < CLOSE_SCORE_THRESHOLD && top.provider.costType !== "free") {
      const freeIdx = scored.findIndex((s) => s.provider.costType === "free");
      if (freeIdx > 0) {
        const [free] = scored.splice(freeIdx, 1);
        scored.unshift(free);
      }
    }
  }
  return scored;
}

export function selectProvider(providers: AIProvider[]): ScoredProvider | null {
  const ranked = rankProviders(providers);
  return ranked[0] ?? null;
}

export function selectProviderWithFallback(
  providers: AIProvider[],
  failedIds: Set<string>
): ScoredProvider | null {
  const remaining = providers.filter((p) => !failedIds.has(p.id));
  const result = selectProvider(remaining);
  if (result) return result;
  const allAvailable = providers.filter((p) => p.available);
  if (allAvailable.length === 0) return null;
  return rankProviders(allAvailable)[0] ?? null;
}