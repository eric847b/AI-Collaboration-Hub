#!/usr/bin/env python3
"""Bootstrap loader: restore agent from last known-good commit and apply v4.3.2 root-skip."""
import urllib.request

GOOD = (
    "https://raw.githubusercontent.com/eric847b/AI-Collaboration-Hub/"
    "03d9c80197146686c20aafd1ca321a42e3ade624/"
    "autonomous-github-agent/.github/scripts/agent.py"
)

src = urllib.request.urlopen(GOOD, timeout=60).read().decode("utf-8")

# v4.3.2: never select monorepo root for lockfile PRs
old = '''        has_deps = _package_json_has_deps(root)
        rel = root if root != "." else "."
        if rel in seen:
            continue
        if _path_should_skip_lockfile_scan(rel):
            continue
        seen.add(rel)'''
new = '''        has_deps = _package_json_has_deps(root)
        rel = root if root != "." else "."
        if rel in seen:
            continue
        # Never open lockfile PRs for monorepo root (empty workspace package.json)
        if rel in (".", ""):
            continue
        if _path_should_skip_lockfile_scan(rel):
            continue
        seen.add(rel)'''
if old in src:
    src = src.replace(old, new, 1)

old2 = '''    # v4.3.1: skip lockfile work if an open bot PR already covers this project
    if task_type == "lockfile":
        proj = task.get("project_dir", ".")
        title_hint = task.get("title", "") or proj
        if open_bot_pr_exists_for(proj) or open_bot_pr_exists_for(title_hint):
            logger.info(f"Skip lockfile task — open bot PR already exists for {proj}")
            return False'''
new2 = '''    # v4.3.2: skip root/userscripts + dedupe open bot PRs
    if task_type == "lockfile":
        proj = task.get("project_dir", ".")
        if proj in (".", "") or _path_should_skip_lockfile_scan(str(proj)):
            logger.info(f"Skip lockfile task for root/nested path: {proj}")
            return False
        title_hint = task.get("title", "") or proj
        if open_bot_pr_exists_for(proj) or open_bot_pr_exists_for(title_hint):
            logger.info(f"Skip lockfile task — open bot PR already exists for {proj}")
            return False'''
if old2 in src:
    src = src.replace(old2, new2, 1)

src = src.replace("Perfected v4.3.1", "Perfected v4.3.2", 1)
src = src.replace('Starting agent v4.3.1', 'Starting agent v4.3.2')
src = src.replace('Agent v4.3.1 complete', 'Agent v4.3.2 complete')
src = src.replace('profile.data["version"] = "4.3.1"', 'profile.data["version"] = "4.3.2"')

exec(compile(src, "agent.py", "exec"), {"__name__": "__main__", "__file__": __file__})
