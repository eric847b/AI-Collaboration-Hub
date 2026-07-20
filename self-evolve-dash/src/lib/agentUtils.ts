import { supabase } from "@/integrations/supabase/client";
import { calculateTrustScore } from "./trustUtils";

export async function generateScript(task: string) {
  const { data, error } = await supabase.functions.invoke('process-task', {
    body: { task, isAutonomous: true }
  });
  
  if (error) throw error;
  return data.script;
}

export async function testScript(script: any) {
  const { data, error } = await supabase.functions.invoke('test-script', {
    body: { scriptId: script.id, code: script.code }
  });
  
  if (error) throw error;
  
  // Calculate trust score
  const trustScore = calculateTrustScore({
    confidenceScore: data.confidence,
    testResults: data,
    iterations: script.iterations || 0,
  });
  
  return {
    pass: data.passed && data.confidence >= 70,
    error: data.issues?.join(', ') || null,
    confidence: data.confidence,
    trustScore,
  };
}

export async function reviseScript(script: any, errorContext: string) {
  const { data, error } = await supabase.functions.invoke('autonomous-improve', {
    body: { scriptId: script.id, errorContext }
  });
  
  if (error) throw error;
  
  // Fetch updated script
  const { data: updated } = await supabase
    .from('scripts')
    .select('*')
    .eq('id', script.id)
    .single();
    
  return updated;
}

export async function archiveVersion(script: any, status: string) {
  const { error } = await supabase
    .from('scripts')
    .update({ status, is_archived: status !== 'stable' })
    .eq('id', script.id);
    
  if (error) throw error;
}

export async function logAction(details: any) {
  await supabase.from('activity_logs').insert({
    type: details.result === 'pass' ? 'success' : 'warning',
    message: `Autonomous agent: ${details.result}`,
    details: JSON.stringify({
      ...details,
      trustScore: details.trustScore,
    }),
    script_id: details.scriptId
  });
}
