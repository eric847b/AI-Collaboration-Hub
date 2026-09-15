"""Shared profile persistence with material-change and fleet-state gates."""
from __future__ import annotations

import base64
import json
import os
import time
from pathlib import Path
from typing import Any

import requests

PROFILE_PATH=Path(os.getenv("AGENT_PROFILE_PATH",".agent_profile.json"))
REPO_NAME=os.getenv("GITHUB_REPOSITORY","eric847b/autonomous-github-agent")
FLEET_FIELDS=("last_fleet_run","fleet_issue_url","fleet_coordinator_runs","fleet_last_summary","fleet_last_health","fleet_pulse")
COUNTER_FIELDS=("runs","failures_triaged","failure_solver_runs","profile_persists","notifications_handled","issues_created","stale_branches_deleted","gmail_triaged","gmail_marked_read","fleet_coordinator_runs")
VOLATILE_FIELDS:set[str]={"runs","last_run","evolution_velocity","failure_solver_runs","roi_catalyst_runs","roi_last_run","notif_categories","notifications_handled","depth_history","llm_calls","total_tokens_used","inbox_cleared","gmail_triaged","gmail_marked_read","preflight_skips","errors","security_events","injections_blocked","high_risk_actions_blocked","fleet_pulse","last_fleet_run","fleet_issue_url",*COUNTER_FIELDS}
HEARTBEAT_RUNS=int(os.getenv("PROFILE_PERSIST_HEARTBEAT_RUNS","0"))
FLEET_HEARTBEAT_RUNS=int(os.getenv("FLEET_PROFILE_HEARTBEAT_RUNS","12"))
PERSIST_MAX_ATTEMPTS=5;PERSIST_BASE_DELAY_S=.6

def gh_headers():
 t=os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN");return {"Authorization":f"token {t}","Accept":"application/vnd.github+json"} if t else {}
def load_local_profile()->dict[str,Any]:
 try:return json.loads(PROFILE_PATH.read_text()) if PROFILE_PATH.exists() else {}
 except Exception:return {}
def save_local_profile(p:dict[str,Any])->None:PROFILE_PATH.write_text(json.dumps(p,indent=2)+"\n")
def merge_profiles(base:dict[str,Any],overlay:dict[str,Any],preserve_fleet_from:dict[str, Any] | None=None)->dict[str,Any]:
 o=dict(base);o.update(overlay);src=preserve_fleet_from if preserve_fleet_from is not None else base
 for k in FLEET_FIELDS:
  if k not in overlay or overlay.get(k) in (None,"",0):
   if src.get(k) not in (None,"",0):o[k]=src[k]
  else:o[k]=overlay[k]
 for k in COUNTER_FIELDS:o[k]=max(int(base.get(k) or 0),int(overlay.get(k) or 0),int(src.get(k) or 0))
 return o
def _prefer_newer_fleet(m:dict[str,Any],local:dict[str,Any],remote:dict[str,Any])->None:
 try:
  lr,rr=local.get("last_fleet_run"),remote.get("last_fleet_run")
  src=remote if lr and rr and str(lr)<str(rr) else local if lr else remote
  if src:
   for k in ("last_fleet_run","fleet_issue_url","fleet_pulse","fleet_last_health","fleet_last_summary"):
    if src.get(k):m[k]=src[k]
 except Exception:pass
def _norm(v:Any)->str:
 try:return json.dumps(v,sort_keys=True,default=str)
 except Exception:return str(v)
def material_delta(local:dict[str,Any],remote:dict[str,Any])->bool:
 return any(k not in VOLATILE_FIELDS and k not in {"fleet_last_summary","fleet_last_health"} and _norm(local.get(k))!=_norm(remote.get(k)) for k in set(local)|set(remote))
def fleet_state_delta(local:dict[str,Any],remote:dict[str,Any])->bool:
 return _norm(local.get("fleet_last_health"))!=_norm(remote.get("fleet_last_health"))
def should_persist(local:dict[str,Any],remote:dict[str,Any])->tuple:
 if not remote:return True,"no_remote_profile"
 if material_delta(local,remote):return True,"material_change"
 if fleet_state_delta(local,remote):return True,"fleet_health_change"
 runs=int(local.get("runs") or 0)
 if HEARTBEAT_RUNS>0 and runs and runs%HEARTBEAT_RUNS==0:return True,f"heartbeat_every_{HEARTBEAT_RUNS}_runs"
 fr=int(local.get("fleet_coordinator_runs") or 0)
 if FLEET_HEARTBEAT_RUNS>0 and fr and fr%FLEET_HEARTBEAT_RUNS==0:return True,f"fleet_heartbeat_every_{FLEET_HEARTBEAT_RUNS}_runs"
 return False,"volatile_only_skip"
def fetch_remote_profile(repo_name:str | None=None)->tuple:
 h=gh_headers()
 if not h:return None,{}
 try:
  r=requests.get(f"https://api.github.com/repos/{repo_name or REPO_NAME}/contents/.agent_profile.json",headers=h,params={"ref":"main"},timeout=20)
  if r.status_code==404:return None,{}
  if r.status_code!=200:return None,{}
  d=r.json() or {};raw=base64.b64decode((d.get("content") or "").replace("\n","")).decode()
  return d.get("sha"),json.loads(raw)
 except Exception:return None,{}
def persist_merged_profile(local:dict[str,Any],repo_name:str | None=None,message:str | None=None,force:bool=False)->str:
 h=gh_headers()
 if not h:return "NO_TOKEN"
 repo=repo_name or REPO_NAME;url=f"https://api.github.com/repos/{repo}/contents/.agent_profile.json"
 sha,remote=fetch_remote_profile(repo)
 if not force:
  ok,reason=should_persist(local,remote or {})
  if not ok:
   m=merge_profiles(remote or {},local,preserve_fleet_from=remote or local);_prefer_newer_fleet(m,local,remote or {});save_local_profile(m);return f"SKIP_PERSIST:{reason}"
 last_err="PUT_FAIL:unknown"
 for attempt in range(PERSIST_MAX_ATTEMPTS):
  sha,remote=fetch_remote_profile(repo);m=merge_profiles(remote or {},local,preserve_fleet_from=remote or local);_prefer_newer_fleet(m,local,remote or {});content=json.dumps(m,indent=2)+"\n";save_local_profile(m)
  payload={"message":message or "chore(agent): persist material profile state [skip ci]","content":base64.b64encode(content.encode()).decode(),"branch":"main"}
  if sha:payload["sha"]=sha
  try:
   r=requests.put(url,headers=h,json=payload,timeout=30)
   if r.status_code in (200,201):m["profile_persists"]=int(m.get("profile_persists") or 0)+1;save_local_profile(m);return f"PERSISTED:{r.status_code}"
   if r.status_code==409 and attempt<PERSIST_MAX_ATTEMPTS-1:time.sleep(PERSIST_BASE_DELAY_S*(2**attempt));last_err="PUT_FAIL:409:retrying";continue
   last_err=f"PUT_FAIL:{r.status_code}:{r.text[:120]}"
   if r.status_code!=409:return last_err
  except Exception as e:
   last_err=f"PERSIST_FAIL:{str(e)[:120]}"
   if attempt<PERSIST_MAX_ATTEMPTS-1:time.sleep(PERSIST_BASE_DELAY_S*(2**attempt));continue
   return last_err
 return last_err
