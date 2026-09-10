"""Resilient controller for the 10-minute autonomous loop (codex_loop.yml).

Idempotent by design: each run inspects repo state and acts only when there
is concrete, non-duplicated work - a diverged auto-evolve branch with no
open PR. Quiet no-op otherwise, so the high-frequency schedule never spams
issues, duplicates PRs, or crashes the runner.
"""

import os
import sys

BRANCH = os.getenv("EVOLVE_BRANCH", "auto-evolve")


def execute(task):
    try:
        from github import Github
    except ModuleNotFoundError:
        print("[controller] PyGithub not installed - pip install PyGithub")
        return {"status": "error_fallback", "error": "PyGithub missing"}
    g = Github(os.getenv("GITHUB_TOKEN"))
    repo_name = task.get("repo") or os.getenv("REPO", "")
    if not repo_name:
        print("[controller] no repo resolved (REPO env unset)")
        return {"status": "error_fallback", "error": "no repo resolved"}
    repo = g.get_repo(repo_name)
    try:
        branch_names = {b.name for b in repo.get_branches()}
        if BRANCH not in branch_names:
            print(f"[controller] branch {BRANCH!r} absent - nothing to propagate")
            return {"status": "noop"}
        comparison = repo.compare("main", BRANCH)
        if comparison.total_commits == 0:
            print(f"[controller] {BRANCH} matches main - nothing to propagate")
            return {"status": "noop"}
        head = f"{repo.owner.login}:{BRANCH}"
        open_prs = list(repo.get_pulls(state="open", head=head, base="main"))
        if open_prs:
            print(f"[controller] PR #{open_prs[0].number} already open for {BRANCH}")
            return {"status": "pr_open", "pr_number": open_prs[0].number}
        pr = repo.create_pull(
            title=task.get("title", f"Auto-propagate {BRANCH}"),
            body="Propagated autonomous fixes + agent updates.",
            head=BRANCH,
            base="main",
        )
        print(f"[controller] created PR #{pr.number}")
        return {"status": "pr_created", "pr_number": pr.number}
    except Exception as e:  # noqa: BLE001 - the loop must never die mid-cycle
        print(f"[controller] error_fallback: {e}")
        return {"status": "error_fallback", "error": str(e)}


def main():
    if not os.getenv("GITHUB_TOKEN"):
        print("[controller] GITHUB_TOKEN missing - exiting")
        sys.exit(1)
    result = execute({"repo": os.getenv("REPO")})
    print(f"[controller] result: {result}")


if __name__ == "__main__":
    main()
