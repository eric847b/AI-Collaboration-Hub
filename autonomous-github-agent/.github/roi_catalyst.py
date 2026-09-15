"""ROI Catalyst — highest-return root action prioritization.
v4.3.1 — load local status gate reliably in direct/script execution.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from status_gate import status_changed

FLEET=["eric847b/autonomous-github-agent","eric847b/singularity-operator","eric847b/AI-Collaboration-Hub","eric847b/zero-cost-wealth-playbook-tool","eric847b/modular-hub-modernization"]
HOST_REPO=os.getenv("GITHUB_REPOSITORY","eric847b/autonomous-github-agent")
ROI_ISSUE_TITLE="🚀 Fleet ROI Catalyst Status (auto-updated)"
ROI_VERSION="4.3.1"
STATUS_LABELS=frozenset({"roi-catalyst","fleet-status"})
STATUS_TITLE_PREFIXES=("🚀 Fleet ROI Catalyst","📊 Fleet FailureSolver","Fleet ROI Catalyst Status","Fleet FailureSolver Status","⚡ Catalyst Intelligence")
NOTIFICATION_TITLE_PREFIXES=("📬 Notification:","Notification:")
CURRENCY_KW=("revenue","payment","invoice","cash","wallet","crypto","bank","income","monetize","sell","price","pricing","mrr","arr","wealth","profit","earn","payout","transfer","deposit")
PROJECT_KW=("milestone","ship","launch","release","deploy","unlock","blocker","critical path","mvp","beta","ga","production","singularity","evolution","self-evolve","apex")
CONFLICT_KW=("conflict","resolve","dispute","unblock","stuck","deadlock","priority","escalate","decision needed","owner decision")
HIGH_LABELS={"bug","security","urgent","critical","blocker","revenue","opportunity"}
HEALTH_MULT={"critical":1.35,"attention":1.15,"ok":1.0,"unknown":1.05}

def _headers():
 t=os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
 return {"Authorization":f"token {t}","Accept":"application/vnd.github+json"} if t else {}

def _utc_now_iso(): return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")

def _is_non_work_issue(i):
 title=i.get("title") or ""; labels=[str(x.get("name","")).lower() for x in i.get("labels") or []]
 return bool(any(x in STATUS_LABELS for x in labels) or any(title.startswith(x) for x in STATUS_TITLE_PREFIXES) or "(auto-updated)" in title.lower() or any(title.startswith(x) for x in NOTIFICATION_TITLE_PREFIXES) or ("notification" in labels and "inbox" in labels))

def _score_text(blob):
 lower=(blob or "").lower(); score=0.; cats=[]
 if any(k in lower for k in CURRENCY_KW): score+=40; cats.append("currency")
 if any(k in lower for k in PROJECT_KW): score+=30; cats.append("project")
 if any(k in lower for k in CONFLICT_KW): score+=25; cats.append("conflict")
 return score,cats

def _repo_health_map(profile): return {str(x["repo"]):str(x.get("health") or "unknown") for x in (profile or {}).get("fleet_pulse") or [] if isinstance(x,dict) and x.get("repo")}

def _score_issue(issue,repo,health_map=None):
 title=issue.get("title") or ""; body=(issue.get("body") or "")[:2000]; labels=[str(x.get("name","")).lower() for x in issue.get("labels") or []]
 score,cats=_score_text(f"{title}\n{body}\n{' '.join(labels)}"); score+=20
 for lab in labels:
  if lab in HIGH_LABELS: score+=15
  if lab in ("revenue","opportunity","blocker","security"): score+=20
  if lab in ("runtime-failure","self-heal"): score+=12; cats += [] if "self-heal" in cats else ["self-heal"]
 comments=int(issue.get("comments") or 0); score += 10 if comments==0 else 5 if comments<3 else 0
 if repo==HOST_REPO: score+=5
 health=(health_map or {}).get(repo,"unknown"); mult=HEALTH_MULT.get(health,1.)
 if health in ("critical","attention") and ("self-heal" in cats or "runtime-failure" in labels): mult=max(mult,1.4 if health=="critical" else 1.2)
 return {"repo":repo,"number":issue.get("number"),"title":title[:160],"html_url":issue.get("html_url"),"labels":labels,"score":round(min(score*mult,100),1),"categories":cats,"comments":comments,"updated_at":issue.get("updated_at"),"repo_health":health,"health_mult":mult,"is_status":False}

def fetch_open_issues(repo,per_page=20):
 h=_headers()
 if not h:return []
 try:
  r=requests.get(f"https://api.github.com/repos/{repo}/issues",headers=h,params={"state":"open","per_page":per_page,"sort":"updated","direction":"desc"},timeout=20)
  return [i for i in (r.json() or []) if not i.get("pull_request")] if r.status_code==200 else []
 except Exception:return []

def rank_fleet_roi(max_per_repo=12,health_map=None):
 work=[]; non_work=[]
 for repo in FLEET:
  for i in fetch_open_issues(repo,max_per_repo):
   if _is_non_work_issue(i): non_work.append({"repo":repo,"number":i.get("number"),"title":(i.get("title") or "")[:160],"html_url":i.get("html_url"),"labels":[str(x.get("name","")).lower() for x in i.get("labels") or []],"is_status":True})
   else: work.append(_score_issue(i,repo,health_map))
 work.sort(key=lambda x:x["score"],reverse=True); return work,non_work

def build_next_prompt(top,pulse_summary=None):
 p=""
 if pulse_summary:
  h=pulse_summary.get("overall_health") or "unknown"; p=f" Fleet health=`{h}` (open_fail={pulse_summary.get('open_runtime_failure_issues')}, draft_autofix={pulse_summary.get('open_draft_autofix_prs')})."
  if h in ("attention","critical"): p+=" Prefer clearing runtime-failure / draft auto-fix before new feature work."
 if not top:return "No high-ROI open work issue across fleet."+p+" Next: open one real work issue on highest-leverage repo with catalyst labels."
 cats=", ".join(top.get("categories") or ["general"]); return f"Execute root ROI on {top['repo']}#{top['number']}: {top['title']}. Categories: {cats}. Repo health=`{top.get('repo_health')}`.{p} Measurable progress only (draft PR / closed loop / currency artifact)."

def find_roi_issue(headers):
 try:
  r=requests.get(f"https://api.github.com/repos/{HOST_REPO}/issues",headers=headers,params={"state":"open","per_page":40,"labels":"roi-catalyst"},timeout=20)
  if r.status_code==200:
   for i in r.json() or []:
    if (i.get("title") or "").startswith("🚀 Fleet ROI Catalyst"): return i
 except Exception as e: print(f"[roi_catalyst] find_roi_issue: {e}")
 return None

def upsert_roi_issue(ranked,top,status_issues=None,pulse_summary=None):
 h=_headers()
 if not h:return {"error":"NO_TOKEN"}
 lines=[f"**Generated:** `{_utc_now_iso()}`  ",f"**Module:** ROI Catalyst v{ROI_VERSION} (pulse-weighted)  ",f"**Work candidates:** {len(ranked)} · **Excluded:** {len(status_issues or [])}",""]
 if pulse_summary: lines += ["### Fleet Pulse",f"- Overall: `{pulse_summary.get('overall_health','n/a')}` · open_fail={pulse_summary.get('open_runtime_failure_issues')} · drafts={pulse_summary.get('open_draft_autofix_prs')}",""]
 lines.append("### Root action")
 if top: lines += [f"- **[{top['repo']}#{top['number']}]({top.get('html_url')})** score **{top['score']}** (health=`{top.get('repo_health')}` ×{top.get('health_mult')})  ",f"  `{top['title']}`","","**Next prompt:**",f"```\n{build_next_prompt(top,pulse_summary)}\n```"]
 else: lines.append(f"- None above threshold. `{build_next_prompt(None,pulse_summary)}`")
 lines += ["","### Top 8"]
 for n,item in enumerate((ranked or [])[:8],1): lines.append(f"{n}. [{item['repo']}#{item['number']}]({item.get('html_url')}) score={item['score']} h=`{item.get('repo_health')}` — {item['title'][:80]}")
 lines += ["","---",f"ROI Catalyst v{ROI_VERSION}. No force-merge."]
 body="\n".join(lines); existing=find_roi_issue(h)
 try:
  if existing:
   if not status_changed(existing.get("body"),body): return {"action":"unchanged","number":existing.get("number"),"html_url":existing.get("html_url")}
   r=requests.patch(f"https://api.github.com/repos/{HOST_REPO}/issues/{existing['number']}",headers=h,json={"body":body,"title":ROI_ISSUE_TITLE},timeout=20)
   return {"action":"updated","number":existing.get("number"),"html_url":existing.get("html_url")} if r.status_code==200 else {"error":f"patch:{r.status_code}"}
  r=requests.post(f"https://api.github.com/repos/{HOST_REPO}/issues",headers=h,json={"title":ROI_ISSUE_TITLE,"body":body,"labels":["roi-catalyst","catalyst","self-heal"]},timeout=20)
  if r.status_code in (200,201):
   d=r.json(); return {"action":"created","number":d.get("number"),"html_url":d.get("html_url")}
  return {"error":f"create:{r.status_code}"}
 except Exception as e:return {"error":str(e)[:150]}

def run_roi_catalyst(profile=None,record_error=None):
 record=record_error or (lambda e,c="":print(f"[ERROR:{c}] {e}")); profile=profile if profile is not None else {}
 try:
  health_map=_repo_health_map(profile); ranked,status_issues=rank_fleet_roi(health_map=health_map); top=ranked[0] if ranked else None
  if top and top["score"]<30: top=None
  pulse_summary=None
  try:
   if profile.get("fleet_last_summary") and profile.get("fleet_last_health"):
    pulse_summary=dict(profile.get("fleet_last_summary") or {}); pulse_summary.setdefault("overall_health",profile.get("fleet_last_health"))
   else:
    from fleet_pulse import apply_pulse_to_profile, collect_fleet_pulse
    pulse=collect_fleet_pulse(); pulse_summary=pulse.get("summary") or {}; apply_pulse_to_profile(profile,pulse); health_map=_repo_health_map(profile); ranked,status_issues=rank_fleet_roi(health_map); top=ranked[0] if ranked else None
    if top and top["score"]<30: top=None
  except Exception as e: print(f"[roi_catalyst] pulse context skip: {e}")
  result=upsert_roi_issue(ranked,top,status_issues,pulse_summary); next_prompt=build_next_prompt(top,pulse_summary)
  profile["roi_catalyst_runs"]=int(profile.get("roi_catalyst_runs") or 0)+1; profile["roi_last_run"]=_utc_now_iso()
  if result.get("html_url"): profile["roi_issue_url"]=result["html_url"]
  profile["roi_top_score"]=top["score"] if top else 0; profile["roi_top_ref"]=f"{top['repo']}#{top['number']}" if top else None
  Path("roi-catalyst-status.json").write_text(json.dumps({"generated_at":_utc_now_iso(),"version":ROI_VERSION,"top":top,"next_prompt":next_prompt,"issue":result},indent=2)+"\n")
  summary=f"roi_ok work={len(ranked)} top={top['repo']+'#'+str(top['number']) if top else 'none'} score={top['score'] if top else 0} pulse={(pulse_summary or {}).get('overall_health','n/a')}"; print(f"[roi_catalyst] {summary}"); return summary
 except Exception as e: record(e,"roi_catalyst"); return f"ROI_CATALYST_FAIL:{str(e)[:120]}"

if __name__=="__main__": print(run_roi_catalyst())
