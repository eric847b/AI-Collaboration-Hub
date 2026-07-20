#!/usr/bin/env python3
"""
Advanced Tools for Autonomous GitHub Agent v4.0
High-value features: cross-repo sync, issue management, security dashboard
"""

import os
import json
from datetime import datetime
from typing import Dict, List, Optional

try:
    from github import Github
    GITHUB_AVAILABLE = True
except ImportError:
    GITHUB_AVAILABLE = False


def sync_repository(repo_name: str, token: str, source_repo: str = None) -> Dict:
    """
    Cross-repository synchronization - propagate improvements to other repos.
    High-value feature: enables ecosystem-wide improvement propagation.
    """
    result = {"synced": False, "pr_created": None, "error": ""}
    
    if not GITHUB_AVAILABLE or not token:
        return {"synced": False, "error": "GitHub unavailable or no token"}
    
    try:
        g = Github(token)
        target_repo = g.get_repo(repo_name)
        
        # Scan for security improvements to propagate
        improvements = []
        for root, dirs, files in os.walk('.github'):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in files:
                if f.endswith(('.yml', '.yaml', '.py')):
                    path = os.path.join(root, f)
                    try:
                        with open(path, 'r') as file:
                            content = file.read()
                            # Detect security improvements to propagate
                            security_indicators = ['sanitize', 'security', 'injection', 'is_high_risk']
                            if any(ind in content.lower() for ind in security_indicators):
                                improvements.append(path)
                    except:
                        pass
        
        if improvements:
            # Create a tracking issue for cross-repo sync
            issue_title = f"🤖 Sync improvements from {source_repo or os.getenv('REPO', 'autonomous-github-agent')}"
            issue_body = f"Recommended improvements detected:\n" + "\n".join(f"- `{imp}`" for imp in improvements[:10])
            
            issue = target_repo.create_issue(
                title=issue_title,
                body=issue_body
            )
            result["pr_created"] = f"Issue #{issue.number} created"
            result["synced"] = True
            
        return result
    except Exception as e:
        result["error"] = str(e)
        return result


def create_security_dashboard(profile_path: str = ".agent_profile.json") -> str:
    """
    Generate a security dashboard markdown report.
    High-value feature: visibility into security posture.
    """
    lines = ["# Security Dashboard", ""]
    
    # Load profile data
    profile_data = {}
    if os.path.exists(profile_path):
        try:
            with open(profile_path, 'r') as f:
                profile_data = json.load(f)
        except:
            pass
    
    lines.extend([
        "## Summary",
        f"- Total runs: {profile_data.get('runs', 0)}",
        f"- Security events: {profile_data.get('security_events', 0)}",
        f"- Injections blocked: {profile_data.get('injections_blocked', 0)}",
        f"- High-risk actions blocked: {profile_data.get('high_risk_blocked', 0)}",
        f"- Error rate: {profile_data.get('errors', 0) / max(profile_data.get('runs', 1), 1) * 100:.1f}%",
        "",
        "## Provider Performance",
    ])
    
    for provider, stats in profile_data.get("provider_stats", {}).items():
        avg_lat = stats.get("latency", 0)
        calls = stats.get("calls", 0)
        lines.append(f"- **{provider}**: {calls} calls, avg latency: {avg_lat:.2f}s")
    
    lines.extend([
        "",
        "## Active Directives",
    ])
    
    for directive in profile_data.get("directives", []):
        lines.append(f"- {directive}")
    
    lines.extend([
        "",
        "## Security Controls Active",
        "- Input sanitization for prompt injection",
        "- HTML comment removal",
        "- Dangerous pattern blocking",
        "- Path traversal prevention",
        "- Branch name sanitization",
        "- Security event logging",
        "- Draft PR workflow (human review gate)",
        "- Depth control for recursion",
        "",
        f"*Generated: {datetime.now().isoformat()}*",
    ])
    
    return "\n".join(lines)


def post_comment(pr_number: int, body: str, token: str, repo: str) -> Dict:
    """Post a comment to a pull request."""
    if not GITHUB_AVAILABLE:
        return {"success": False, "error": "GitHub not available"}
    
    try:
        g = Github(token)
        r = g.get_repo(repo)
        pr = r.get_pull(pr_number)
        pr.create_issue_comment(body)
        return {"success": True, "output": f"Commented on PR #{pr_number}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def close_issue(issue_number: int, token: str, repo: str, comment: str = "") -> Dict:
    """Close a GitHub issue with optional comment."""
    if not GITHUB_AVAILABLE:
        return {"success": False, "error": "GitHub not available"}
    
    try:
        g = Github(token)
        r = g.get_repo(repo)
        issue = r.get_issue(issue_number)
        if comment:
            issue.create_comment(f"Auto-closing: {comment}")
        issue.edit(state="closed")
        return {"success": True, "output": f"Closed issue #{issue_number}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def create_sub_issue(parent_id: int, title: str, body: str, token: str, repo: str) -> Dict:
    """Create a sub-issue under a parent issue."""
    if not GITHUB_AVAILABLE:
        return {"success": False, "error": "GitHub not available"}
    
    try:
        g = Github(token)
        r = g.get_repo(repo)
        parent = r.get_issue(parent_id)
        sub = r.create_issue(
            title=f"[{parent_id}] {title}",
            body=f"Parent: #{parent_id}\n\n{body}"
        )
        # Try to add sub-issue label
        try:
            sub.add_to_labels("sub-issue")
        except:
            pass
        return {"success": True, "output": f"Created sub-issue #{sub.number}", "sub_number": sub.number}
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_security_dashboard(output_path: str = "SECURITY_DASHBOARD.md") -> bool:
    """Write the security dashboard to a file."""
    try:
        content = create_security_dashboard()
        with open(output_path, 'w') as f:
            f.write(content)
        return True
    except Exception as e:
        print(f"Dashboard write error: {e}")
        return False


if __name__ == "__main__":
    # Generate dashboard on demand
    write_security_dashboard()
    print("Security dashboard generated")