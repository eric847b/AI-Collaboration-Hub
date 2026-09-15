"""Stale branch hygiene for Autonomous GitHub Agent (v3.4.0).

Deletes branches fully incorporated into base (default main).
Safety: never protected names/flags, never open-PR heads.
Fully incorporated = ahead_by==0 OR head of a closed+merged PR (covers squash).

Optional (opt-in, fail-closed):
  allow_abandoned_closed — delete heads of closed *unmerged* PRs older than
  abandoned_min_age_days (default 14). Controlled by parameter or env
  STALE_ALLOW_ABANDONED=1.

Fleet helper: cleanup_fleet_stale_branches() walks Sigma FLEET (or custom list).
Fail closed on API errors.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from urllib.parse import quote

import requests
from action_ledger import begin as ledger_begin
from action_ledger import finish as ledger_finish

PROTECTED_BRANCH_NAMES = frozenset({"main","master","develop","development","production","prod","staging"})
DEFAULT_FLEET=["eric847b/autonomous-github-agent","eric847b/singularity-operator","eric847b/AI-Collaboration-Hub","eric847b/zero-cost-wealth-playbook-tool","eric847b/modular-hub-modernization"]

def _headers()->dict | None:
    token=os.getenv("GH_FULL_PAT") or os.getenv("GITHUB_TOKEN")
    return {"Authorization":f"token {token}","Accept":"application/vnd.github+json"} if token else None

def _parse_iso(ts:str | None)->datetime | None:
    if not ts:return None
    try:return datetime.fromisoformat(ts[:-1]+"+00:00" if ts.endswith("Z") else ts).astimezone(timezone.utc)
    except Exception:return None

def _env_bool(name:str,default:bool=False)->bool:
    raw=(os.getenv(name) or "").strip().lower()
    return default if not raw else raw in ("1","true","yes","on")

def cleanup_stale_branches(repo_name:str,profile:dict | None=None,base:str="main",dry_run:bool=False,record_error=None,allow_abandoned_closed:bool | None=None,abandoned_min_age_days:int=14)->str:
    headers=_headers()
    if not headers:return "NO_TOKEN"
    profile=profile if profile is not None else {};deleted=[];skipped=[]
    if allow_abandoned_closed is None:allow_abandoned_closed=_env_bool("STALE_ALLOW_ABANDONED",False)
    def _err(msg:str,ctx:str="stale_branch"):
        if record_error:record_error(msg,ctx)
        else:print(f"[ERROR:{ctx}] {msg[:200]}")
    try:
        branches=[];page=1
        while page<=10:
            resp=requests.get(f"https://api.github.com/repos/{repo_name}/branches",headers=headers,params={"per_page":100,"page":page},timeout=20)
            if resp.status_code!=200:raise RuntimeError(f"BRANCH_LIST:{resp.status_code}")
            batch=resp.json() or []
            if not batch:break
            branches.extend(batch)
            if len(batch)<100:break
            page+=1
        open_heads=set();page=1
        while page<=5:
            resp=requests.get(f"https://api.github.com/repos/{repo_name}/pulls",headers=headers,params={"state":"open","per_page":100,"page":page},timeout=20)
            if resp.status_code!=200:break
            batch=resp.json() or []
            if not batch:break
            for pr in batch:
                ref=(pr.get("head") or {}).get("ref")
                if ref:open_heads.add(ref)
            if len(batch)<100:break
            page+=1
        merged_heads=set();abandoned_closed={};page=1
        while page<=10:
            resp=requests.get(f"https://api.github.com/repos/{repo_name}/pulls",headers=headers,params={"state":"closed","per_page":100,"page":page,"base":base,"sort":"updated","direction":"desc"},timeout=20)
            if resp.status_code!=200:break
            batch=resp.json() or []
            if not batch:break
            for pr in batch:
                ref=(pr.get("head") or {}).get("ref")
                if not ref:continue
                if pr.get("merged_at"):merged_heads.add(ref)
                else:
                    closed_at=_parse_iso(pr.get("closed_at"))
                    if closed_at and (ref not in abandoned_closed or closed_at<abandoned_closed[ref]):abandoned_closed[ref]=closed_at
            if len(batch)<100:break
            page+=1
        now=datetime.now(timezone.utc);min_age=max(0,int(abandoned_min_age_days))
        for b in branches:
            name=b.get("name") or ""
            if not name or name==base or name in PROTECTED_BRANCH_NAMES:skipped.append(f"{name or '?'}:protected_name");continue
            if b.get("protected"):skipped.append(f"{name}:protected_flag");continue
            if name in open_heads:skipped.append(f"{name}:open_pr");continue
            incorporated=name in merged_heads
            if not incorporated:
                cresp=requests.get(f"https://api.github.com/repos/{repo_name}/compare/{quote(base,safe='')}...{quote(name,safe='')}",headers=headers,timeout=20)
                if cresp.status_code!=200:skipped.append(f"{name}:compare_failed");continue
                data=cresp.json() or {};incorporated=data.get("ahead_by",1)==0 or data.get("status","") in ("identical","behind")
            reason="merged" if incorporated else None
            if not incorporated and allow_abandoned_closed and name in abandoned_closed:
                age_days=(now-abandoned_closed[name]).total_seconds()/86400.0
                if age_days>=min_age:incorporated=True;reason=f"abandoned_closed_age={age_days:.1f}d"
                else:skipped.append(f"{name}:abandoned_too_young_{age_days:.1f}d");continue
            if not incorporated:skipped.append(f"{name}:has_unique_commits");continue
            label=f"{name}:{reason}" if reason and reason!="merged" else name
            if dry_run:deleted.append(f"{label}:would_delete");continue
            ledger_reason=reason or "merged"
            if not ledger_begin("delete_stale_branch",f"{repo_name}:{name}",ledger_reason):
                skipped.append(f"{name}:ledger_blocked");continue
            ref=f"heads/{name}"
            try:
                dresp=requests.delete(f"https://api.github.com/repos/{repo_name}/git/refs/{quote(ref,safe='/')}",headers=headers,timeout=15)
                if dresp.status_code in (200,204):
                    deleted.append(label);ledger_finish("delete_stale_branch",f"{repo_name}:{name}","success",ledger_reason)
                else:
                    skipped.append(f"{name}:delete_failed_{dresp.status_code}");ledger_finish("delete_stale_branch",f"{repo_name}:{name}","failed",ledger_reason,str(dresp.status_code));_err(f"delete {name}: {dresp.status_code}","stale_branch_delete")
            except Exception as exc:
                ledger_finish("delete_stale_branch",f"{repo_name}:{name}","failed",ledger_reason,str(exc));raise
        if deleted and not dry_run:
            real=[d for d in deleted if not str(d).endswith(":would_delete")];profile["stale_branches_deleted"]=profile.get("stale_branches_deleted",0)+len(real)
        summary=f"stale_branches deleted={len(deleted)} [{', '.join(deleted) or 'none'}] skipped={len(skipped)} abandoned_mode={'on' if allow_abandoned_closed else 'off'}"
        print(f"[stale_branches] {repo_name}: {summary}")
        if skipped:print(f"[stale_branches] skipped: {skipped[:20]}")
        return summary
    except Exception as exc:_err(str(exc),"cleanup_stale_branches");return f"STALE_BRANCH_FAIL:{str(exc)[:120]}"

def cleanup_fleet_stale_branches(fleet:list[str] | None=None,profile:dict | None=None,base:str="main",dry_run:bool=False,record_error=None,allow_abandoned_closed:bool | None=None,abandoned_min_age_days:int=14)->str:
    repos=list(fleet or DEFAULT_FLEET);parts=[]
    for repo in repos:
        try:parts.append(f"{repo}=>{cleanup_stale_branches(repo,profile=profile,base=base,dry_run=dry_run,record_error=record_error,allow_abandoned_closed=allow_abandoned_closed,abandoned_min_age_days=abandoned_min_age_days)}")
        except Exception as exc:
            msg=f"{repo}=>FAIL:{str(exc)[:80]}";parts.append(msg)
            if record_error:record_error(msg,"fleet_stale")
    summary=f"fleet_stale repos={len(repos)} | " + " ; ".join(parts);print(f"[stale_branches] {summary[:500]}");return summary
