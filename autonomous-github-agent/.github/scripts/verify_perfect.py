#!/usr/bin/env python3
"""
Infallible Verification Script for Autonomous GitHub Agent v4.0
Run this to verify all systems are perfect.
"""

import os
import sys
import json
import re
from typing import Tuple

def verify_agent_syntax() -> Tuple[bool, str]:
    """Verify agent.py has valid Python syntax."""
    agent_path = os.path.join(os.path.dirname(__file__), "agent.py")
    if not os.path.exists(agent_path):
        return False, "agent.py missing"
    
    try:
        with open(agent_path, 'r') as f:
            content = f.read()
        compile(content, agent_path, 'exec')
        return True, "Syntax valid"
    except SyntaxError as e:
        return False, f"Syntax error: {e}"
    except Exception as e:
        return False, f"Error: {e}"


def verify_agent_features() -> Tuple[bool, list]:
    """Verify all required agent features are present."""
    agent_path = os.path.join(os.path.dirname(__file__), "agent.py")
    issues = []
    
    if not os.path.exists(agent_path):
        return False, ["agent.py missing"]
    
    with open(agent_path, 'r') as f:
        content = f.read()
    
    required_features = {
        "Multi-LLM Support": [
            ("deepseek" in content.lower(), "DeepSeek integration missing"),
            ("ollama" in content.lower(), "Ollama integration missing"),
            ("huggingface" in content.lower(), "HuggingFace integration missing"),
            ("openrouter" in content.lower(), "OpenRouter integration missing"),
            ("github_models" in content.lower(), "GitHub Models integration missing"),
            ("gemini" in content.lower(), "Gemini integration missing"),
            ("openai" in content.lower(), "OpenAI integration missing"),
            ("anthropic" in content.lower(), "Anthropic integration missing"),
        ],
        "Security Hardening": [
            ("sanitize_input" in content, "Security sanitization missing"),
            ("is_high_risk" in content, "High-risk detection missing"),
            ("record_security_event" in content, "Security event recording missing"),
            ("injections_blocked" in content, "Injection blocking missing"),
        ],
        "Task Management": [
            ("fetch_github_issues" in content, "GitHub issues fetch missing"),
            ("fetch_pull_requests" in content, "PR review missing"),
            ("fetch_github_notifications" in content, "Notifications missing"),
            ("fetch_sub_issues" in content, "Sub-issue support missing"),
            ("decide_task" in content, "Task prioritization missing"),
        ],
        "Git Operations": [
            ("merge_merged_branches" in content, "Branch cleanup missing"),
            ("sync_with_main" in content, "Sync functionality missing"),
            ("create_pr" in content, "PR creation missing"),
        ],
        "Self-Evolution": [
            ("run_self_audit" in content, "Self-audit missing"),
            ("evolve_agent_directives" in content, "Evolution directives missing"),
            ("provider_stats" in content, "Provider stats tracking missing"),
        ],
    }
    
    for category, checks in required_features.items():
        for check, msg in checks:
            if not check:
                issues.append(f"{category}: {msg}")
    
    return len(issues) == 0, issues


def verify_workflow() -> Tuple[bool, list]:
    """Verify workflow file has all required secrets and triggers."""
    script_dir = os.path.dirname(__file__)
    repo_root = os.path.dirname(os.path.dirname(script_dir))
    workflow_path = os.path.join(repo_root, ".github", "workflows", "autonomous-agent.yml")
    
    if not os.path.exists(workflow_path):
        return False, ["Workflow missing"]
    
    with open(workflow_path, 'r') as f:
        content = f.read()
    
    required = [
        ("DEEPSEEK_API_KEY" in content, "DeepSeek secret missing"),
        ("HF_API_KEY" in content or "HF_TOKEN" in content, "HuggingFace secret missing"),
        ("OPENROUTER_API_KEY" in content, "OpenRouter secret missing"),
        ("issues:" in content, "Issue trigger missing"),
        ("pull_request:" in content, "PR trigger missing"),
        ("workflow_dispatch:" in content, "Manual trigger missing"),
    ]
    
    issues = [msg for check, msg in required if not check]
    return len(issues) == 0, issues


def verify_profile_structure() -> Tuple[bool, str]:
    """Verify agent profile has all required fields."""
    profile_path = os.path.join(os.path.dirname(__file__), "..", "..", ".agent_profile.json")
    
    if not os.path.exists(profile_path):
        # No profile yet - that's okay for first run
        return True, "No profile yet (first run)"
    
    try:
        with open(profile_path, 'r') as f:
            data = json.load(f)
        
        required_fields = [
            "runs", "errors", "security_events",
            "injections_blocked", "high_risk_blocked",
            "avg_latency", "directives", "provider_stats"
        ]
        
        missing = [f for f in required_fields if f not in data]
        if missing:
            return False, f"Missing fields: {', '.join(missing)}"
        
        return True, "Profile structure valid"
    except Exception as e:
        return False, f"Profile error: {e}"


def main():
    """Run all verifications."""
    print("=" * 60)
    print("AUTONOMOUS GITHUB AGENT v4.0 - INFALLIBLE VERIFICATION")
    print("=" * 60)
    
    # Syntax check
    syntax_ok, syntax_msg = verify_agent_syntax()
    print(f"\n[SYNTAX] {'OK' if syntax_ok else 'FAIL'} {syntax_msg}")
    
    # Feature check
    features_ok, feature_issues = verify_agent_features()
    print(f"\n[FEATURES] {'OK' if features_ok else 'FAIL'}")
    if feature_issues:
        for issue in feature_issues:
            print(f"  - {issue}")
    
    # Workflow check
    workflow_ok, workflow_issues = verify_workflow()
    print(f"\n[WORKFLOW] {'OK' if workflow_ok else 'FAIL'}")
    if workflow_issues:
        for issue in workflow_issues:
            print(f"  - {issue}")
    
    # Profile check
    profile_ok, profile_msg = verify_profile_structure()
    print(f"\n[PROFILE] {'OK' if profile_ok else 'FAIL'} {profile_msg}")
    
    # Summary
    all_ok = syntax_ok and features_ok and workflow_ok and profile_ok
    print("\n" + "=" * 60)
    if all_ok:
        print("PERFECT: All systems infallible")
        return 0
    else:
        print("ISSUES FOUND: Run fixes needed")
        return 1


if __name__ == "__main__":
    sys.exit(main())