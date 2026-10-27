import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCollaborationMetrics, type CollaborationMetrics, type CollaborationResource } from "@/lib/collaborationMetrics";
function dedupe(metrics: CollaborationMetrics): CollaborationResource[] {
 const map = new Map<string, CollaborationResource>();
 Object.values(metrics.rankings_by_task || {}).flat().forEach(r => { const old = map.get(r.id); if (!old || (r.score || 0) > (old.score || 0)) map.set(r.id, r); });
 return [...map.values()].sort((a,b) => (b.score || 0) - (a.score || 0)).slice(0,12);
}
export function CollaborationMetricsPanel() {
 const [metrics,setMetrics]=useState<CollaborationMetrics|null>(null),[error,setError]=useState(""),[loading,setLoading]=useState(false),[refresh,setRefresh]=useState(0);
 const load=useCallback(async(signal?:AbortSignal)=>{setLoading(true);setError("");try{setMetrics(await fetchCollaborationMetrics(signal));}catch(e){if(!(e instanceof DOMException&&e.name==="AbortError"))setError(e instanceof Error?e.message:"Metrics unavailable");}finally{setLoading(false);}},[]);
 useEffect(()=>{const c=new AbortController();void load(c.signal);return()=>c.abort();},[load,refresh]);
 const s=metrics?.summary||{},resources=useMemo(()=>metrics?dedupe(metrics):[],[metrics]);
 return <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5"/>Fleet collaboration</CardTitle><Button variant="outline" size="sm" disabled={loading} onClick={()=>setRefresh(n=>n+1)}><RefreshCw className="h-4 w-4 mr-2"/>Refresh</Button></CardHeader><CardContent className="space-y-4">
 {error&&<p className="text-sm text-destructive"><AlertTriangle className="inline h-4 w-4 mr-2"/>{error}</p>}
 {!metrics&&!error&&<p className="text-sm text-muted-foreground">{loading?"Loading shared metrics…":"No shared metrics loaded yet."}</p>}
 {metrics&&<><div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[["Providers ready",s.providers_available],["Calls",s.provider_calls],["Failures",s.provider_failures],["Rotations",s.provider_rotations],["Measured quotas",s.resources_with_measured_remaining],["Tracked resources",s.resources_tracked],["Handoffs queued",s.handoffs_queued],["Handoffs completed",s.handoffs_completed]].map(([k,v])=><div key={String(k)} className="rounded-lg border p-3"><div className="text-xl font-semibold">{v??"Unknown"}</div><div className="text-xs text-muted-foreground">{k}</div></div>)}</div>
 <p className="text-xs text-muted-foreground">{metrics.schema} · updated {new Date(metrics.generated_at).toLocaleString()} · free-only {String(metrics.policy?.free_only??true)}</p>
 <div className="flex flex-wrap gap-2">{(metrics.providers||[]).map(p=><span key={p.id} className="rounded-full border px-2 py-1 text-xs">{p.id}: {p.status}</span>)}</div>
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Resource</th><th className="p-2">Remaining / quota</th><th className="p-2">Reset ETA</th><th className="p-2">Confidence</th><th className="p-2">Score</th></tr></thead><tbody>{resources.map(r=><tr key={r.id} className="border-b"><td className="p-2 font-mono text-xs">{r.id}</td><td className="p-2">{r.remaining??"Unknown"} / {r.quota??"Unknown"}</td><td className="p-2">{r.hours_to_refill==null?"Unknown":r.hours_to_refill+"h"}</td><td className="p-2">{r.confidence||"Unknown"}</td><td className="p-2">{r.schedulable?r.score:"—"}</td></tr>)}</tbody></table></div>
 <p className="text-xs text-muted-foreground">{metrics.renewal_policy||"Unknown quotas are not treated as unlimited."} Recommendations do not authorize spending or merging.</p></>}
 </CardContent></Card>;
}
