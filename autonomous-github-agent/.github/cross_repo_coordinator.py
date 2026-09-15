#!/usr/bin/env python3
"""Cross-repo FailureSolver Coordinator v1.7 — semantic status gate."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

sys.path.insert(0,str(Path(__file__).resolve().parent))
from failure_solver import get_failure_solver
from status_gate import status_changed

FLEET=["eric847b/autonomous-github-agent","eric847b/singularity-operator","eric847b/AI-Collaboration-Hub","eric847b/zero-cost-wealth-playbook-tool","eric847b/modular-hub-modernization"]
HOST_REPO=os.getenv("GITHUB_REPOSITORY","eric847b/autonomous-github-agent")
FLEET_ISSUE_TITLE="📊 Fleet FailureSolver Status (auto-updated)"

def _headers():
 t=os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
 return {"Authorization":f"token {t}","Accept":"application/vnd.github+json"} if t else {}

def scan_repo(repo):
 profile={}
 def record(e,c=""): print(f"[{repo}] ERROR:{c} {e}")
 try:
  s=get_failure_solver(repo,profile=profile,record_error=record); analyses=s.scan_and_prioritize(max_runs=8); created=[]
  for a in analyses[:2]:
   if a.get("top_score",0)<55: continue
   r=s.create_remediation_issue(a)
   if r and r.get("number"): created.append({"number":r["number"],"class":r.get("class"),"url":r.get("html_url")})
   try:
    from failure_solver_draft_ext import create_draft_pr_for_safe_class
    pr=create_draft_pr_for_safe_class(s,a)
    if pr and pr.get("number"): created.append({"pr":pr["number"],"class":pr.get("class"),"url":pr.get("html_url")})
   except Exception: pass
  return {"repo":repo,"failed_runs":len(analyses),"top_classes":[a.get("top_class") for a in analyses[:5]],"top_scores":[round(a.get("top_score",0),1) for a in analyses[:5]],"created":created,"ok":True}
 except Exception as e:return {"repo":repo,"ok":False,"error":str(e)[:200]}

def find_fleet_issue(headers):
 try:
  r=requests.get(f"https://api.github.com/repos/{HOST_REPO}/issues",headers=headers,params={"state":"open","per_page":50,"labels":"fleet-status"},timeout=20)
  if r.status_code==200:
   for i in r.json() or []:
    if i.get("title")==FLEET_ISSUE_TITLE:return i
  r=requests.get(f"https://api.github.com/repos/{HOST_REPO}/issues",headers=headers,params={"state":"open","per_page":30},timeout=20)
  if r.status_code==200:
   for i in r.json() or []:
    if (i.get("title") or "").startswith("📊 Fleet FailureSolver"):return i
 except Exception as e:print(f"find_fleet_issue: {e}")
 return None

def upsert_fleet_issue(report):
 h=_headers()
 if not h:return {"error":"NO_TOKEN"}
 summary=report.get("summary") or {}; pulse=report.get("fleet_pulse") or {}; ps=pulse.get("summary") or {}
 lines=[f"**Generated:** `{report.get('generated_at')}`  ","**Coordinator:** v1.7 + Fleet Pulse  ",f"**Repos OK:** {summary.get('repos_ok')}/{summary.get('repos_scanned')}  ",f"**Failed runs seen (scan):** {summary.get('total_failed_runs_seen')}  ",f"**Items created this pass:** {summary.get('items_created')}  ",f"**Pulse health:** `{ps.get('overall_health',summary.get('overall_health','n/a'))}`  ",f"**Open runtime-failure issues (fleet):** {ps.get('open_runtime_failure_issues','—')}  ",f"**Open draft auto-fix PRs (fleet):** {ps.get('open_draft_autofix_prs','—')}  ",f"**Recent failed workflow runs (sample):** {ps.get('recent_failed_runs','—')}","","### Per-repo (FailureSolver scan)"]
 for r in report.get("results") or []:
  if not r.get("ok"): lines.append(f"- ❌ `{r.get('repo')}` — {r.get('error','error')[:80]}"); continue
  created=r.get("created") or []; cs=", ".join((f"[#{c['number']}]({c.get('url')})" if "number" in c else f"[PR#{c.get('pr')}]({c.get('url')})") for c in created) or "—"
  lines.append(f"- ✅ `{r.get('repo')}` — failed_runs={r.get('failed_runs',0)} | top={r.get('top_classes',[])[:3]} | created: {cs}")
 lines.append(""); lines.append("### Per-repo (Fleet Pulse)")
 for p in pulse.get("repos") or []:
  if not p.get("ok"): lines.append(f"- ❓ `{p.get('repo')}` — {p.get('error','error')[:60]}"); continue
  icon={"ok":"🟢","attention":"🟠","critical":"🔴"}.get(p.get("health"),"⚪")
  lines.append(f"- {icon} `{p.get('repo')}` — health=`{p.get('health')}` | open_fail_issues={p.get('open_runtime_failure_issues')} | draft_autofix={p.get('open_draft_autofix_prs')} | recent_failed_runs={p.get('recent_failed_runs')}")
 lines += ["","---","Auto-updated by **Cross-Repo FailureSolver Coordinator**. Safe: issues + draft PRs only.","Dashboard: https://eric847b.github.io/autonomous-github-agent/","Label: `fleet-status`"]
 body="\n".join(lines); existing=find_fleet_issue(h)
 try:
  if existing:
   if not status_changed(existing.get("body"),body): return {"action":"unchanged","number":existing.get("number"),"html_url":existing.get("html_url")}
   r=requests.patch(f"https://api.github.com/repos/{HOST_REPO}/issues/{existing['number']}",headers=h,json={"body":body,"title":FLEET_ISSUE_TITLE},timeout=20)
   return {"action":"updated","number":existing.get("number"),"html_url":existing.get("html_url")} if r.status_code==200 else {"error":f"patch:{r.status_code}"}
  r=requests.post(f"https://api.github.com/repos/{HOST_REPO}/issues",headers=h,json={"title":FLEET_ISSUE_TITLE,"body":body,"labels":["fleet-status","self-heal","catalyst"]},timeout=20)
  if r.status_code in (200,201): d=r.json(); return {"action":"created","number":d.get("number"),"html_url":d.get("html_url")}
  return {"error":f"create:{r.status_code}","detail":r.text[:120]}
 except Exception as e:return {"error":str(e)[:120]}

def main():
 report={"generated_at":datetime.now(timezone.utc).isoformat()+"Z","version":"1.7","fleet":FLEET,"results":[]}
 for repo in FLEET: print(f"=== Scanning {repo} ==="); report["results"].append(scan_repo(repo))
 try:
  from fleet_pulse import collect_fleet_pulse
  report["fleet_pulse"]=collect_fleet_pulse(FLEET)
  print(f"[fleet_pulse] overall={report['fleet_pulse'].get('summary',{}).get('overall_health')}")
 except Exception as e: print(f"[fleet_pulse] skip: {e}"); report["fleet_pulse"]={"repos":[],"summary":{}}
 total_failed=sum(r.get("failed_runs",0) for r in report["results"] if r.get("ok")); total_created=sum(len(r.get("created",[])) for r in report["results"] if r.get("ok")); ps=(report.get("fleet_pulse") or {}).get("summary") or {}
 report["summary"]={"repos_scanned":len(FLEET),"repos_ok":sum(1 for r in report["results"] if r.get("ok")),"total_failed_runs_seen":total_failed,"items_created":total_created,"open_runtime_failure_issues":ps.get("open_runtime_failure_issues"),"open_draft_autofix_prs":ps.get("open_draft_autofix_prs"),"recent_failed_runs":ps.get("recent_failed_runs"),"overall_health":ps.get("overall_health")}
 report["fleet_issue"]=upsert_fleet_issue(report)
 try:
  from fleet_health_notify import post_health_pulse
  report["health_pulse"]=post_health_pulse(report,host_repo=HOST_REPO); print(f"[health_pulse] {report['health_pulse']}")
 except Exception as e: print(f"[health_pulse] skip: {e}")
 try:
  from high_severity_notify import notify_high_severity
  report["high_severity"]=notify_high_severity(report,host_repo=HOST_REPO); print(f"[high_severity] {report['high_severity'].get('status')} count={report['high_severity'].get('critical_count',0)}")
 except Exception as e: print(f"[high_severity] skip: {e}")
 out=Path("cross-repo-failure-report.json"); out.write_text(json.dumps(report,indent=2)+"\n"); print(f"Report written to {out}")
if __name__=="__main__": main()
