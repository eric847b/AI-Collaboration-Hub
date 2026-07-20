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
    
    const { scriptId, code } = await req.json();
    console.log('Testing script:', scriptId);

    // AI-based validation
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a code validator for Tampermonkey userscripts. Analyze the script and return a JSON object with:
{
  "passed": true/false,
  "confidence": 0-100,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}

Check for:
- Syntax errors
- Missing @match or @include directives
- Security issues (eval, unsafe DOM manipulation)
- Best practices compliance
- Performance concerns`
          },
          {
            role: 'user',
            content: `Validate this userscript:\n\n${code}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const validationResult = JSON.parse(aiData.choices[0].message.content);

    // Update script with test results
    const { error: updateError } = await supabase
      .from('scripts')
      .update({
        confidence_score: validationResult.confidence,
        test_results: [{
          timestamp: new Date().toISOString(),
          passed: validationResult.passed,
          issues: validationResult.issues,
          suggestions: validationResult.suggestions
        }]
      })
      .eq('id', scriptId);

    if (updateError) {
      throw updateError;
    }

    // Log test results
    await supabase.from('activity_logs').insert({
      type: validationResult.passed ? 'success' : 'warning',
      message: `Script test ${validationResult.passed ? 'passed' : 'failed'}`,
      details: `Confidence: ${validationResult.confidence}%. Issues: ${validationResult.issues.length}`,
      script_id: scriptId
    });

    return new Response(
      JSON.stringify(validationResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in test-script function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
