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
  if (token === supabaseAnonKey) return { id: 'anon', role: 'anon' };
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

const APPLY_IMPROVEMENT_PROMPT = `You are an AI system architect that applies improvements to code.

Given an improvement suggestion with implementation steps, generate the exact code changes needed.

You will receive:
1. Target file path
2. Current file content (if modifying existing file)
3. Improvement description
4. Implementation steps

Generate code that:
- Follows the implementation steps precisely
- Maintains existing functionality
- Uses TypeScript with proper types
- Follows React and Tailwind best practices
- Includes comments explaining changes
- Is production-ready and tested

Return ONLY the complete updated code, no explanations or markdown.`;

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
    
    const { suggestion, filePath, currentCode, autoApply } = await req.json();
    console.log('Applying improvement to:', filePath);

    const confidence = calculateConfidence(suggestion);
    
    if (autoApply && confidence < 85) {
      throw new Error(`Confidence too low for auto-apply: ${confidence}%`);
    }

    await supabase.from('activity_logs').insert({
      type: 'ai',
      message: `🔧 Applying improvement: ${suggestion.title}`,
      details: JSON.stringify({ filePath, priority: suggestion.priority, confidence })
    });

    const userPrompt = currentCode
      ? `Current code in ${filePath}:\n\n${currentCode}\n\n---\n\nImprovement needed:\nTitle: ${suggestion.title}\nDescription: ${suggestion.description}\nImplementation steps:\n${suggestion.implementation}\n\nGenerate the complete updated code.`
      : `Create new file ${filePath}:\n\nImprovement: ${suggestion.title}\nDescription: ${suggestion.description}\nImplementation steps:\n${suggestion.implementation}\n\nGenerate the complete code.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: APPLY_IMPROVEMENT_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text().catch(() => '');
      console.error('AI gateway error:', aiResponse.status, errText);

      // Graceful degradation: return 200 with a fallback flag so the client
      // can back off / queue locally instead of treating it as a hard failure.
      if (aiResponse.status === 429 || aiResponse.status === 402 || aiResponse.status >= 500) {
        const retryAfter = aiResponse.status === 429 ? 60 : aiResponse.status === 402 ? 300 : 30;
        return new Response(
          JSON.stringify({
            success: false,
            rateLimited: aiResponse.status === 429,
            paymentRequired: aiResponse.status === 402,
            fallback: true,
            retryAfter,
            error: `AI gateway returned ${aiResponse.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let improvedCode = aiData.choices[0].message.content;
    
    improvedCode = improvedCode.replace(/```(?:typescript|tsx|ts|javascript|jsx|js)?\n?/g, '');
    improvedCode = improvedCode.trim();

    await supabase.from('activity_logs').insert({
      type: 'success',
      message: `✨ Improvement applied: ${suggestion.title}`,
      details: JSON.stringify({
        filePath,
        priority: suggestion.priority,
        confidence,
        autoApplied: autoApply,
        codeLength: improvedCode.length
      })
    });

    return new Response(
      JSON.stringify({
        success: true,
        code: improvedCode,
        filePath,
        confidence,
        suggestion: suggestion.title,
        autoApplied: autoApply,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Apply improvement error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('activity_logs').insert({
        type: 'error',
        message: `❌ Failed to apply improvement`,
        details: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateConfidence(suggestion: any): number {
  let confidence = 70;
  if (suggestion.priority === 'high') confidence += 10;
  else if (suggestion.priority === 'low') confidence -= 10;
  if (suggestion.implementation && suggestion.implementation.length > 100) confidence += 10;
  if (suggestion.impact && suggestion.impact.length > 50) confidence += 5;
  return Math.min(100, Math.max(50, confidence));
}
