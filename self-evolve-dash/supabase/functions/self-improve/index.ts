import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (token === serviceKey) return { id: 'service-role', role: 'service_role' };
  // Allow anon-key invocation (internal/autonomous client calls without a user session)
  if (token === supabaseAnonKey) return { id: 'anon', role: 'anon' };
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

const SYSTEM_PROMPTS = {
  dashboard: `You are analyzing a React dashboard for an autonomous Tampermonkey script management system.

Evaluate these aspects:
1. **Layout & Navigation**: Tab structure, information hierarchy, visual flow
2. **User Experience**: Clarity of status indicators, ease of finding features
3. **Visual Design**: Color scheme usage, spacing, animations, accessibility
4. **Performance**: Component rendering, unnecessary re-renders, optimization opportunities

Provide 3 specific, actionable improvements that enhance usability and efficiency.`,

  components: `You are analyzing React component architecture and code quality.

Focus on:
1. **Component Structure**: Reusability, composition patterns, separation of concerns
2. **Performance**: Memoization opportunities, lazy loading, optimization techniques
3. **Code Quality**: TypeScript usage, prop types, error handling, maintainability
4. **State Management**: Hook usage, state lifting, context patterns

Provide 3 concrete improvements with implementation details.`,

  'agent-logic': `You are analyzing autonomous agent logic for script generation and improvement.

Examine:
1. **Generation Algorithm**: AI prompt engineering, script quality, consistency
2. **Testing Strategy**: Validation logic, confidence scoring, error detection
3. **Recovery Mechanisms**: Retry logic, error handling, rollback strategies
4. **Decision Making**: When to commit, when to revise, autonomy vs control

Provide 3 improvements that enhance reliability and effectiveness.`,

  performance: `You are analyzing system performance and resource efficiency.

Analyze:
1. **Database Operations**: Query optimization, indexing, connection pooling
2. **API Efficiency**: Edge function optimization, caching strategies, rate limits
3. **Frontend Performance**: Bundle size, code splitting, render optimization
4. **Resource Usage**: Memory management, background processes, cleanup

Provide 3 performance improvements with measurable impact.`
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const user = await authenticateRequest(req, supabaseUrl, supabaseAnonKey);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { targetType, currentState } = await req.json();
    console.log('Self-improvement analysis for:', targetType);

    const metrics = await gatherMetrics(supabase);
    const systemPrompt = SYSTEM_PROMPTS[targetType as keyof typeof SYSTEM_PROMPTS] || SYSTEM_PROMPTS.dashboard;

    await supabase.from('activity_logs').insert({
      type: 'ai',
      message: `🧠 Analyzing ${targetType} for improvements`,
      details: `Metrics: ${metrics.activeScripts} active scripts, ${metrics.successRate}% success rate`
    });

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Current system state:
- Target: ${targetType}
- Active Scripts: ${metrics.activeScripts}
- Success Rate: ${metrics.successRate}%
- Recent Activity: ${metrics.recentActivity} events/hour
- Autonomous: ${currentState?.autonomous || false}

Provide your response as JSON:
{
  "suggestions": [
    {
      "title": "Brief improvement title",
      "description": "What needs improvement and why",
      "priority": "high|medium|low",
      "impact": "Expected benefits and outcomes",
      "implementation": "Step-by-step implementation guide"
    }
  ]
}`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      // Soft-degrade on rate limit / payment required so the autonomous
      // engine doesn't loop on a non-2xx error.
      if (aiResponse.status === 429 || aiResponse.status === 402) {
        const retryAfter = Number(aiResponse.headers.get('retry-after')) || 60;
        console.warn(`AI gateway ${aiResponse.status} — degrading. retryAfter=${retryAfter}s`);
        await supabase.from('activity_logs').insert({
          type: 'warning',
          message: `⏳ AI rate-limited (${aiResponse.status}) for ${targetType}`,
          details: `Skipping cycle, retry after ${retryAfter}s`,
        });
        return new Response(
          JSON.stringify({
            success: true,
            rateLimited: true,
            retryAfter,
            targetType,
            suggestions: [],
            metrics,
            timestamp: new Date().toISOString(),
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errBody = await aiResponse.text().catch(() => '');
      throw new Error(`AI API failed: ${aiResponse.status} ${errBody.slice(0, 200)}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData?.choices?.[0]?.message?.content ?? '';
    
    let suggestions;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      suggestions = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Parse error:', e);
      suggestions = { suggestions: [] };
    }

    const suggestionCount = suggestions.suggestions?.length || 0;

    await supabase.from('activity_logs').insert({
      type: 'success',
      message: `✨ Found ${suggestionCount} improvements for ${targetType}`,
      details: JSON.stringify(suggestions)
    });

    return new Response(
      JSON.stringify({
        success: true,
        targetType,
        suggestions: suggestions.suggestions || [],
        metrics,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Self-improvement error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function gatherMetrics(supabase: any) {
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  
  const [scriptsTotal, scriptsActive, recentLogs] = await Promise.all([
    supabase.from('scripts').select('*', { count: 'exact', head: true }),
    supabase.from('scripts').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('activity_logs').select('type').gte('created_at', oneHourAgo).limit(100)
  ]);

  const successCount = recentLogs.data?.filter((log: any) => log.type === 'success').length || 0;
  const totalLogs = recentLogs.data?.length || 1;

  return {
    totalScripts: scriptsTotal.count || 0,
    activeScripts: scriptsActive.count || 0,
    successRate: Math.round((successCount / totalLogs) * 100),
    recentActivity: totalLogs
  };
}
