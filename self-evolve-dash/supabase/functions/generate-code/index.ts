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

const CODE_GENERATION_PROMPTS = {
  component: `You are an expert React/TypeScript developer. Generate a complete, production-ready React component.

Requirements:
- Use TypeScript with proper types and interfaces
- Follow React best practices (hooks, functional components)
- Use Tailwind CSS with semantic tokens from the design system
- Include proper error handling and loading states
- Add comments for complex logic
- Make it responsive and accessible
- Use shadcn/ui components where appropriate

Return ONLY the complete code, no explanations.`,

  utility: `You are an expert TypeScript developer. Generate a utility function or module.

Requirements:
- Pure TypeScript with full type safety
- Include JSDoc comments
- Handle edge cases and errors
- Write clean, maintainable code
- Export all necessary functions and types

Return ONLY the complete code, no explanations.`,

  hook: `You are an expert React hooks developer. Generate a custom React hook.

Requirements:
- TypeScript with proper return types
- Follow hooks rules and best practices
- Include proper cleanup in useEffect
- Handle loading and error states
- Add JSDoc comments
- Make it reusable and testable

Return ONLY the complete code, no explanations.`,

  edgeFunction: `You are an expert Deno/Supabase edge function developer. Generate a complete edge function.

Requirements:
- Use Deno standard library
- Include CORS headers
- Proper error handling and logging
- Type-safe request/response handling
- Use Supabase client for database operations
- Follow edge function best practices

Return ONLY the complete code, no explanations.`
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
    
    const { type, description, filePath, existingCode } = await req.json();
    console.log('Code generation request:', type, filePath);

    const systemPrompt = CODE_GENERATION_PROMPTS[type as keyof typeof CODE_GENERATION_PROMPTS] 
      || CODE_GENERATION_PROMPTS.component;

    const userPrompt = existingCode 
      ? `Modify this existing code:\n\n${existingCode}\n\nRequested changes: ${description}`
      : `Create: ${description}`;

    await supabase.from('activity_logs').insert({
      type: 'ai',
      message: `🤖 Generating ${type}: ${filePath}`,
      details: JSON.stringify({ description, type })
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
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI API failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let generatedCode = aiData.choices[0].message.content;
    
    generatedCode = generatedCode.replace(/```(?:typescript|tsx|ts|javascript|jsx|js)?\n?/g, '');
    generatedCode = generatedCode.trim();

    if (!generatedCode || generatedCode.length < 50) {
      throw new Error('Generated code is too short or empty');
    }

    await supabase.from('activity_logs').insert({
      type: 'success',
      message: `✅ Generated ${type}: ${filePath}`,
      details: JSON.stringify({ description, type, codeLength: generatedCode.length })
    });

    return new Response(
      JSON.stringify({
        success: true,
        code: generatedCode,
        filePath,
        type,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Code generation error:', error);
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      await supabase.from('activity_logs').insert({
        type: 'error',
        message: `❌ Code generation failed`,
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
