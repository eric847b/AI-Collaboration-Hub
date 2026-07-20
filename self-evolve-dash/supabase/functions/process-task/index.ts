import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function authenticateRequest(req: Request, supabaseUrl: string, supabaseAnonKey: string) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  // Allow service role calls (function-to-function)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (token === serviceKey) {
    return { id: 'service-role', role: 'service_role' };
  }
  // Allow anon-key invocation (autonomous engine without a user session)
  if (token === supabaseAnonKey) {
    return { id: 'anon', role: 'anon' };
  }
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
    
    const { task, isAutonomous } = await req.json();
    console.log('Processing task:', task, 'Autonomous:', isAutonomous);

    // Log task creation
    await supabase.from('activity_logs').insert({
      type: 'info',
      message: 'Task received',
      details: `Processing: "${task}"`
    });

    // Generate userscript using AI
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
            content: `You are an expert Tampermonkey userscript developer. Generate complete, working userscripts based on user requirements. Always include:
- Proper Tampermonkey headers (@name, @namespace, @version, @description, @match, @grant)
- Clean, functional JavaScript code
- Error handling
- Comments explaining key functionality
Keep scripts focused and practical.`
          },
          {
            role: 'user',
            content: `Create a Tampermonkey userscript for: ${task}`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const scriptCode = aiData.choices[0].message.content;

    // Extract script name from the generated code (from @name header)
    const nameMatch = scriptCode.match(/@name\s+(.+)/);
    const scriptName = nameMatch ? nameMatch[1].trim() : `Script for: ${task.substring(0, 50)}`;
    
    // Insert the script into database
    const { data: newScript, error: insertError } = await supabase
      .from('scripts')
      .insert({
        name: scriptName,
        description: task,
        code: scriptCode,
        version: '1.0.0',
        status: 'testing'
      })
      .select()
      .single();

    if (insertError || !newScript) {
      throw insertError || new Error('Failed to create script');
    }

    // Test the generated script
    const testResponse = await fetch(`${supabaseUrl}/functions/v1/test-script`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        scriptId: newScript.id,
        code: scriptCode
      }),
    });

    let status = 'active';
    if (testResponse.ok) {
      const testResult: any = await testResponse.json();
      if (!testResult.passed || testResult.confidence < 60) {
        status = 'needs_review';
      }
    }

    // Update script status
    await supabase
      .from('scripts')
      .update({ status })
      .eq('id', newScript.id);

    // Log script creation
    await supabase
      .from('activity_logs')
      .insert({
        type: status === 'active' ? 'success' : 'warning',
        message: `Created ${scriptName}`,
        details: status === 'needs_review' ? 'Script may need review' : undefined,
        script_id: newScript.id
      });

    return new Response(
      JSON.stringify({
        success: true,
        script: newScript,
        message: `Successfully created ${scriptName}${isAutonomous ? '. Autonomous improvements will continue in the background.' : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-task function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
