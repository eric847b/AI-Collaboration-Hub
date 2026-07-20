# Resilient controller.py - updated for nexus/self-evolve-dash
# Handles failed workflows, PRs, cross-repo

import os
from github import Github

def execute(task):
    g = Github(os.getenv("GITHUB_TOKEN"))
    repo = g.get_repo(task.get('repo', 'eric847b/nexus-infinity-hub'))
    branch_name = task.get("branch", "auto-evolve")
    try:
        comparison = repo.compare("main", branch_name)
        if comparison.total_commits == 0:
            issue = repo.create_issue(title=f"[Autonomous] {task.get('title')}", body="Resilient fallback: workflow fixed via evolve script.")
            return {"status": "issue_fallback"}
        else:
            pr = repo.create_pull(title=task.get("title", "Auto-fix workflows"), body="Propagated nexus fixes + agent updates.", head=branch_name, base="main")
            return {"status": "pr_created", "pr_number": pr.number}
    except Exception as e:
        return {"status": "error_fallback", "error": str(e)}
