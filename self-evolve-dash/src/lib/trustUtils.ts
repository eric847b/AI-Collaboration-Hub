/**
 * Calculate trust score based on various factors
 * Trust score is a measure of reliability and success rate
 */
export function calculateTrustScore(params: {
  confidenceScore: number;
  testResults?: any;
  iterations: number;
  historicalSuccessRate?: number;
}): number {
  const { confidenceScore, testResults, iterations, historicalSuccessRate = 0.7 } = params;

  // Base score from confidence
  let trustScore = confidenceScore * 0.5;

  // Test results bonus (up to 25 points)
  if (testResults?.passed) {
    trustScore += 25;
  }

  // Iteration bonus (fewer iterations = higher trust, up to 15 points)
  const iterationBonus = Math.max(0, 15 - (iterations * 2));
  trustScore += iterationBonus;

  // Historical success rate (up to 10 points)
  trustScore += historicalSuccessRate * 10;

  return Math.min(100, Math.round(trustScore));
}

/**
 * Determine if a script recovery should be auto-approved
 */
export function shouldAutoApprove(trustScore: number, confidence: number): boolean {
  return trustScore >= 85 && confidence >= 80;
}

/**
 * Get risk level based on trust and confidence scores
 */
export function getRiskLevel(trustScore: number, confidence: number): 'low' | 'medium' | 'high' {
  const avgScore = (trustScore + confidence) / 2;
  if (avgScore >= 80) return 'low';
  if (avgScore >= 60) return 'medium';
  return 'high';
}
