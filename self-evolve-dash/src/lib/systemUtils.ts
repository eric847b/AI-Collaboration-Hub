import { supabase } from "@/integrations/supabase/client";

export interface ImprovementMetrics {
  totalScripts: number;
  activeScripts: number;
  successRate: number;
  averageConfidence: number;
  recentActivity: number;
}

export async function getSystemMetrics(): Promise<ImprovementMetrics> {
  try {
    // Get script counts
    const { count: totalCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true });

    const { count: activeCount } = await supabase
      .from('scripts')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get recent activity
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { data: recentLogs } = await supabase
      .from('activity_logs')
      .select('type')
      .gte('created_at', oneHourAgo);

    const successCount = recentLogs?.filter(log => log.type === 'success').length || 0;
    const totalLogs = recentLogs?.length || 1;

    return {
      totalScripts: totalCount || 0,
      activeScripts: activeCount || 0,
      successRate: Math.round((successCount / totalLogs) * 100),
      averageConfidence: 75, // Placeholder - could be calculated from script metadata
      recentActivity: totalLogs
    };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    return {
      totalScripts: 0,
      activeScripts: 0,
      successRate: 0,
      averageConfidence: 0,
      recentActivity: 0
    };
  }
}

export function generateSystemPrompt(targetType: string, metrics: ImprovementMetrics): string {
  const prompts = {
    dashboard: `Analyze the dashboard layout and user experience for an autonomous script management system.

Current metrics:
- Total scripts: ${metrics.totalScripts}
- Active scripts: ${metrics.activeScripts}  
- Success rate: ${metrics.successRate}%
- Recent activity: ${metrics.recentActivity} events in last hour

Suggest improvements for:
1. Information hierarchy and layout
2. User interaction patterns
3. Visual design and accessibility
4. Performance optimization`,

    components: `Analyze the React component architecture and code quality.

System health:
- ${metrics.activeScripts} active components
- ${metrics.successRate}% reliability
- ${metrics.recentActivity} interactions/hour

Suggest improvements for:
1. Component reusability and composition
2. Performance optimization (memoization, lazy loading)
3. Code maintainability and readability
4. TypeScript usage and type safety`,

    'agent-logic': `Analyze the autonomous agent logic and decision-making.

Current performance:
- Processing ${metrics.activeScripts} active scripts
- ${metrics.successRate}% success rate
- Average confidence: ${metrics.averageConfidence}%

Suggest improvements for:
1. Script generation algorithms
2. Testing and validation logic
3. Error recovery strategies
4. Autonomous decision-making`,

    performance: `Analyze overall system performance and efficiency.

Metrics:
- ${metrics.totalScripts} total scripts
- ${metrics.recentActivity} operations/hour
- ${metrics.successRate}% success rate

Suggest improvements for:
1. Database query optimization
2. API call efficiency
3. Frontend rendering performance
4. Memory and resource usage`
  };

  return prompts[targetType as keyof typeof prompts] || prompts.dashboard;
}

export async function trackImprovement(type: string, description: string, impact: string) {
  try {
    await supabase.from('activity_logs').insert({
      type: 'ai',
      message: `Self-improvement: ${type}`,
      details: JSON.stringify({ description, impact, timestamp: new Date().toISOString() })
    });
  } catch (error) {
    console.error('Error tracking improvement:', error);
  }
}
