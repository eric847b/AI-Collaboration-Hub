import os
from github import Github


def get_tasks():
    """Return actionable tasks for the autonomous agent.
    Currently pulls open issues as tasks. Extend with notifications, PR reviews, etc.
    """
    token = os.getenv("GITHUB_TOKEN")
    repo_name = os.getenv("REPO")

    if not token or not repo_name:
        print("Missing GITHUB_TOKEN or REPO env")
        return []

    try:
        g = Github(token)
        repo = g.get_repo(repo_name)

        tasks = []
        for issue in list(repo.get_issues(state="open", sort="updated"))[:10]:
            tasks.append({
                "type": "issue_triage",
                "id": issue.number,
                "title": issue.title,
                "body": (issue.body or "")[:2000],
                "impact": 2.0 if "bug" in (issue.title.lower() + (issue.body or "").lower()) else 1.0,
                "risk": 0.2,
                "url": issue.html_url
            })

        # Future: integrate github___list_notifications equivalent via PyGithub or API
        return tasks
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        return []
