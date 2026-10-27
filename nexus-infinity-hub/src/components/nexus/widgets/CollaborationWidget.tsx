import { useEffect, useState } from "react";
import { Activity, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

type Resource = { id: string; status?: string; remaining: number | null; quota: number | null; hours_to_refill: number | null; score?: number; schedulable?: boolean };
type Metrics = { schema: string; generated_at: string; summary?: Record<string, number | null>; providers?: { id: string; status: string }[]; provider_tally?: Record<string, { calls?: number; successes?: number; failures?: number; usage_reports?: number; total_tokens?: number; average_latency_ms?: number | null; average_tokens_per_report?: number | null }>; rankings_by_task?: Record<string, Resource[]>; policy?: { resource_ranking_free_only?: boolean; paid_api_fallback_enabled?: boolean } };
const URL = "https://eric847b.github.io/autonomous-github-agent/profile-snapshot.json";
export function CollaborationWidget() {
 const [data,setData]=useState<Metrics|null>(null),[error,setError]=useState(""),[busy,setBusy]=useState(false),[key,setKey]=useState(0);
 useEffect(()=>{const c=new AbortController();fetch(URL+"?t="+Date.now(),{cache:"no-store",signal:c.signal}).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(p=>{const m=p?.collaboration_metrics;if(m?.schema!=="aga.collaboration-metrics.v1")throw new Error("Unsupported metrics schema");setData(m);}).catch(e=>{if(e.name!=="AbortError")setError(String(e.message||e));}).finally(()=>setBusy(false));return()=>c.abort();},[key]);
 const s=data?.summary||{};const unique=new Map<string,Resource>();Object.values(data?.rankings_by_task||{}).flat().forEach(r=>{const old=unique.get(r.id);if(!old||(r.score||0)>(old.score||0))unique.set(r.id,r);});
 const resources=[...unique.values()].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,5);
 return <div className="h-full overflow-auto rounded-xl border border-neon-cyan/20 bg-background/60 p-3 text-sm">
  <div className="flex items-center justify-between gap-2 mb-3"><div className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-neon-cyan"/>Fleet Collaboration</div><Button size="sm" variant="ghost" onClick={()=>{setBusy(true);setError("");setKey(n=>n+1);}} disabled={busy}><RefreshCw className={"h-3.5 w-3.5 "+(busy?"animate-spin":"")}/></Button></div>
  {error&&<p className="text-destructive text-xs">{error}</p>}
  {!data&&!error&&<p className="text-xs text-muted-foreground">{busy?"Loading shared metrics…":"No metrics yet."}</p>}
  {data&&<><div className="grid grid-cols-2 gap-2 mb-3">{[["Providers ready",s.providers_available],["Calls",s.provider_calls],["Failures",s.provider_failures],["Rotations",s.provider_rotations],["Reported tokens",s.provider_total_tokens],["Measured quotas",s.resources_with_measured_remaining],["Handoffs queued",s.handoffs_queued],["Collab runs",s.collaboration_runs],["Collab calls",s.collaboration_provider_calls],["Collab tokens",s.collaboration_tokens_reported]].map(([label,value])=><div key={String(label)} className="rounded-md border border-border/50 p-2"><div className="text-lg font-semibold">{value??"Unknown"}</div><div className="text-[10px] text-muted-foreground">{label}</div></div>)}</div>
  <div className="flex flex-wrap gap-1 mb-3">{(data.providers||[]).map(p=><span key={p.id} className="rounded border px-1.5 py-0.5 text-[10px]">{p.id}:{p.status}</span>)}</div>
  <div className="space-y-1 mb-3">{Object.entries(data.provider_tally||{}).map(([name,t])=><div key={name} className="flex justify-between gap-2 text-[10px] border-b border-border/30 pb-1"><span>{name} · calls {t.calls??"?"} · fail {t.failures??"?"}</span><span className="text-muted-foreground">tokens {(t.usage_reports||0)>0?t.total_tokens??"?":"unreported"} · avg {t.average_latency_ms??"?"}ms</span></div>)}</div>
  <div className="text-xs font-medium mb-1 flex items-center gap-1"><Activity className="h-3 w-3"/>Best renewal-aware candidates</div>
  {resources.map(r=><div key={r.id} className="flex items-center justify-between gap-2 border-t border-border/40 py-1.5 text-xs"><span className="truncate">{r.id}</span><span className="shrink-0 text-muted-foreground">{r.remaining??"?"}/{r.quota??"?"} · {r.hours_to_refill==null?"reset ?":r.hours_to_refill+"h"} · {r.schedulable?r.score:"—"}</span></div>)}
  <p className="mt-2 text-[10px] text-muted-foreground">Updated {new Date(data.generated_at).toLocaleString()}. Free-only resource ranking: {String(data.policy?.resource_ranking_free_only??true)} · OpenAI API fallback: {String(data.policy?.paid_api_fallback_enabled??false)}. Unknown quotas are not assumed unlimited.</p></>}
 </div>;
}
