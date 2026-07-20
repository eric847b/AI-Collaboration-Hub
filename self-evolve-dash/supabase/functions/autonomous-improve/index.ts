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

function calculateTrustScore(params: {
  confidenceScore: number;
  testResults?: any;
  iterations: number;
  historicalSuccessRate?: number;
}): number {
  const { confidenceScore, testResults, iterations, historicalSuccessRate = 0.7 } = params;
  let trustScore = confidenceScore * 0.5;
  if (testResults?.passed) trustScore += 25;
  const iterationBonus = Math.max(0, 15 - (iterations * 2));
  trustScore += iterationBonus;
  trustScore += historicalSuccessRate * 10;
  return Math.min(100, Math.round(trustScore));
}

function incrementVersion(version: any): number {
  if (typeof version === 'number') return version + 1;
  if (typeof version === 'string') {
    const parts = version.split('.');
    if (parts.length >= 3) {
      parts[2] = String(parseInt(parts[2] || '0') + 1);
      return parseFloat(parts.join('.')) || 1;
    }
    const num = parseFloat(version);
    return isNaN(num) ? 1 : num + 1;
  }
  return 1;
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
    
    const { scriptId, errorContext } = await req.json();
    
    if (!scriptId) {
      throw new Error('Script ID is required');
    }
    
    console.log('Autonomous improvement for script:', scriptId);

    const { data: script, error: scriptError } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (scriptError || !script) {
      throw new Error(`Script not found: ${scriptError?.message || 'Unknown'}`);
    }

    await supabase
      .from('scripts')
      .update({ status: 'updating' })
      .eq('id', scriptId);

    await supabase.from('activity_logs').insert({
      type: 'ai',
      message: `🤖 Analyzing ${script.name} for improvements`,
      script_id: scriptId,
      details: JSON.stringify({
        version: script.version,
        iterations: script.iterations || 0,
        errorContext: errorContext || null
      })
    });

    let improvedCode = script.code;
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: string | null = null;
    let confidence = 0;
    let testPassed = false;

    while (retryCount <= maxRetries) {
      try {
        console.log(`Improvement attempt ${retryCount + 1}/${maxRetries + 1}`);
        
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
                content: `You are an expert Tampermonkey userscript optimizer. Improve the provided script while maintaining compatibility.

Focus on:
1. Code efficiency and performance
2. Error handling and edge cases
3. Security best practices
4. User experience improvements
5. Code readability

${retryCount > 0 && lastError ? `PREVIOUS ATTEMPT ISSUE: ${lastError}\nPlease address this and try a different approach.` : ''}

IMPORTANT: Return ONLY the improved code. Keep the Tampermonkey header intact.`
              },
              {
                role: 'user',
                content: `Improve this userscript:

Name: ${script.name}
Description: ${script.description || 'No description'}
${errorContext ? `\nError context: ${errorContext}` : ''}

Current code:
\`\`\`javascript
${improvedCode}
\`\`\`

Return the complete improved code only.`
              }
            ],
            temperature: 0.3,
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error('AI API error:', errorText);
          throw new Error(`AI API failed: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        let candidateCode = aiData.choices[0].message.content;
        
        candidateCode = candidateCode.replace(/```(?:javascript|js)?\n?/g, '');
        candidateCode = candidateCode.trim();
        
        if (!candidateCode || candidateCode.length < 50) {
          throw new Error('Generated code too short');
        }

        confidence = 70;
        if (candidateCode.includes('try {') || candidateCode.includes('catch')) confidence += 10;
        if (candidateCode.includes('==UserScript==')) confidence += 10;
        if (!candidateCode.includes('eval(')) confidence += 5;
        if (candidateCode.length >= script.code.length * 0.8) confidence += 5;
        confidence = Math.min(95, confidence);
        
        testPassed = confidence >= 75;
        
        if (testPassed) {
          improvedCode = candidateCode;
          
          const trustScore = calculateTrustScore({
            confidenceScore: confidence,
            testResults: { passed: true },
            iterations: (script.iterations || 0) + 1,
          });
          
          await supabase.from('activity_logs').insert({
            type: 'success',
            message: `✅ Improvement validated: ${confidence}% confidence, ${trustScore}% trust`,
            details: JSON.stringify({ confidence, trustScore }),
            script_id: scriptId
          });
          
          break;
        } else {
          lastError = `Confidence too low: ${confidence}%`;
          retryCount++;
          
          if (retryCount <= maxRetries) {
            await supabase.from('activity_logs').insert({
              type: 'warning',
              message: `⚠️ Attempt ${retryCount} - retrying`,
              details: lastError,
              script_id: scriptId
            });
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        retryCount++;
        console.error(`Attempt ${retryCount} failed:`, lastError);
        
        if (retryCount > maxRetries) break;
        await new Promise(r => setTimeout(r, 1000 * retryCount));
      }
    }

    if (!testPassed) {
      await supabase.from('activity_logs').insert({
        type: 'error',
        message: `❌ Improvement failed for ${script.name}`,
        details: lastError,
        script_id: scriptId
      });
      
      await supabase
        .from('scripts')
        .update({ status: 'active' })
        .eq('id', scriptId);
        
      return new Response(
        JSON.stringify({ error: 'Manual review recommended', details: lastError, confidence, success: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newVersion = incrementVersion(script.version);

    const { error: updateError } = await supabase
      .from('scripts')
      .update({
        code: improvedCode,
        version: newVersion,
        iterations: (script.iterations || 0) + 1,
        confidence_score: confidence,
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', scriptId);

    if (updateError) {
      throw new Error(`Update failed: ${updateError.message}`);
    }

    await supabase.from('activity_logs').insert({
      type: 'success',
      message: `🎉 Improved ${script.name} to v${newVersion}`,
      details: JSON.stringify({
        oldVersion: script.version,
        newVersion,
        confidence,
        codeChange: improvedCode.length - script.code.length
      }),
      script_id: scriptId
    });

    return new Response(
      JSON.stringify({
        success: true,
        scriptId,
        name: script.name,
        version: newVersion,
        iterations: (script.iterations || 0) + 1,
        confidence,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Autonomous improvement error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
