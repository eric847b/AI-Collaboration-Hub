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

    const user = await authenticateRequest(req, supabaseUrl, supabaseAnonKey);
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { scriptId, versionId } = await req.json();
    console.log('Rolling back script:', scriptId, 'to version:', versionId);

    const { data: version, error: versionError } = await supabase
      .from('script_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (versionError || !version) {
      throw new Error('Version not found');
    }

    const { data: script, error: scriptError } = await supabase
      .from('scripts')
      .select('*')
      .eq('id', scriptId)
      .single();

    if (scriptError || !script) {
      throw new Error('Script not found');
    }

    const { error: updateError } = await supabase
      .from('scripts')
      .update({
        code: version.code,
        version: version.version,
        confidence_score: version.confidence_score,
        test_results: version.test_results,
        updated_at: new Date().toISOString(),
      })
      .eq('id', scriptId);

    if (updateError) {
      throw updateError;
    }

    await supabase.from('activity_logs').insert({
      type: 'warning',
      message: `Rolled back ${script.name}`,
      details: `Restored to version ${version.version}`,
      script_id: scriptId
    });

    return new Response(
      JSON.stringify({ success: true, version: version.version }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in rollback-script function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
