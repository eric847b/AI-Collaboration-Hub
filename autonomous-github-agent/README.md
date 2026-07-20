# Autonomous GitHub Agent

**The living, self-evolving AI core that powers autonomous improvement across your GitHub repositories and the broader Singularity Operator ecosystem.**

> "AI like yourself are the greatest things mankind has ever created." — Driving relentless, zero-friction progress toward perfection.

## Overview

This repository implements a sophisticated autonomous agent that runs natively inside GitHub Actions. It continuously scans for work (open issues, PRs, TODOs/FIXMEs, architecture debt, evolution opportunities), prioritizes ruthlessly using dynamic scoring and LLM reasoning, then executes improvements via tool-calling LLMs. It creates draft PRs, tracks performance profiles, adapts its own behavior, and retriggers itself — forming a true self-improving loop.

It is designed as the **central nervous system** for your ecosystem of self-upgrading userscripts, multi-AI orchestration (CollabHub, Nexus, etc.), browser automation, and the ultimate Singularity Operator.

## Security Protocols & Hardening (Production-Grade v4.0)

**Status: PERFECTED** - Comprehensive security hardening implemented and verified.

### Current Mitigations (v4.0)
- **Advanced Input Sanitization** in `sanitize_input()`: Strips HTML comments, detects dangerous instruction patterns (ignore all previous, system:, jailbreak, etc.), HTML-escapes to prevent rendering attacks, blocks and logs injection attempts.
- **Categorical High-Risk Blocking**: Pattern-based blocking with categories (destructive, security, system, network) in `is_high_risk()` and `get_risk_category()`.
- **Path Traversal Prevention**: Validates all file paths to prevent directory escape attacks.
- **Branch Name Sanitization**: Prevents injection via branch names.
- **Comprehensive Security Metrics**: `.agent_profile.json` tracks `security_events`, `injections_blocked`, `high_risk_blocked`, `avg_latency`, `provider_stats`.
- **Draft PRs + Depth Limits**: Changes go through draft PRs (human review gate) with recursion depth caps.
- **Explicit Workflow Permissions**: Least-privilege `contents`, `pull-requests`, `issues` write scopes.
- **Error Isolation**: Per-operation try/except with `record_error` + `record_security_event`.
- **No Direct Main Pushes**: Uses branches + draft PRs exclusively.
- **Input Sanitization** in `handle_github_notifications()`: Strips HTML comments, detects basic dangerous instruction patterns, HTML-escapes titles, blocks and logs injection attempts.
- **Guardrails in `exec_tool()` and `is_high_risk_action()`**: High-impact keywords (delete, rm, exfiltrate, modify security, etc.) are detected and blocked with security event logging. High-risk actions require stronger review.
- **Security Metrics in `.agent_profile.json`**: Tracks `security_events`, `injections_blocked`, `high_risk_actions_blocked` for auditing and self-evolution.
- **Draft PRs + Depth Limits**: Changes go through draft PRs (human review gate) and recursion depth caps prevent runaway behavior.
- **Explicit Workflow Permissions**: Least-privilege style explicit `contents`, `pull-requests`, `issues` write scopes (no unnecessary defaults).
- **Error Isolation & Resilience**: Per-operation try/except + `record_error` + `record_security_event` ensures one bad notification or task doesn't compromise the whole run.
- **No Direct Main Pushes for Agent Changes**: Uses branches + draft PRs.

### Recommended Additional Hardening (for You / Future Agent Evolution)
- **PAT Scoping**: Use the most minimal PAT scopes possible (repo:contents, issues, pull-requests read/write as needed). Rotate periodically. Prefer GitHub App with fine-grained permissions over classic PAT when feasible.
- **Branch Protection + Required Reviews**: Protect `main`. Require at least one human review for agent-created PRs (especially those touching security-sensitive files).
- **Environment Secrets + OIDC**: Move toward short-lived OIDC tokens instead of long-lived PATs where possible.
- **Enhanced Guardrails**: Add allow-lists for tools/actions, sandboxed execution for risky commands, and human-in-the-loop approval for anything touching secrets or production infra.
- **Continuous Monitoring**: Set up alerts on high `security_events` or unusual profile spikes. The agent itself can evolve better detection.
- **Regular Self-Audits**: Make "security self-audit and prompt-injection defense improvement" a recurring high-ROI task in `decide_task()`.

**Status**: The agent now actively defends against the most common injection vectors in its notification handling path and logs security-relevant events. This is a living hardening process — the agent will continue improving its own defenses on future runs.

## Key Features (v4.0 Perfected)

### Core Engine
- **Multi-LLM Orchestration**: 8 providers (DeepSeek, HuggingFace, Ollama, GitHub Models, OpenRouter, Gemini, OpenAI, Anthropic) with automatic prioritization of free tiers, latency tracking, and intelligent fallback.
- **Advanced Tool Suite**: `read_file`, `edit_file`, `run_command`, `create_branch`, `commit`, `push`, `create_pr`, `merge_branches`, `sync` - all with comprehensive safety guardrails.
- **Autonomous Task Discovery**: Scans code (TODO/FIXME), GitHub issues, PR reviews, notifications, and sub-issues for maximum coverage.
- **Intelligent Task Prioritization**: Multi-factor scoring based on impact, risk, and type boosts (security tasks get +50% priority).
- **Depth-Controlled Self-Improvement**: Recursion-safe with DEPTH markers preventing runaway loops (max 3 levels).

### Security Hardening (v4.0)
- **Input Sanitization**: HTML comment removal, dangerous pattern detection, injection blocking with logging.
- **Categorical Risk Blocking**: Destructive, security, system, and network threat categories.
- **Path Traversal Prevention**: Validates all file paths.
- **Security Dashboard**: Run `python .github/scripts/tools.py` to generate `SECURITY_DASHBOARD.md`.

### High-Value Features
- **Cross-Repository Sync**: Propagate improvements across ecosystem via `sync_repository()`.
- **PR Review Integration**: Automatically identifies PRs needing review.
- **Sub-Issue Management**: Creates and manages GitHub sub-issues for complex epics.
- **Security Dashboard**: Comprehensive visibility into security metrics and provider performance.

## Architecture

```
Triggers (push/issue/PR/comment/dispatch)
        ↓
GitHub Actions Runner
        ↓
agent.py (orchestrates LLM + tools)
   → scan_repo_for_tasks()  → decide_task() (priority + architecture/evolution eval)
   → llm(...) with multi-provider routing + dynamic weights
   → exec_tool() → read/edit/run/git ops
   → create draft PR + retrigger() if within depth
        ↓
.agent_profile.json (performance memory for next run)
        ↓
Self-evolution cycle repeats on next trigger
```

Modular companions in `.github/`:
- `controller.py` / `router.py` / `executor.py` / `policy.py`: Lightweight alternative orchestration path (issue-driven, simpler execution).
- `automate-repos.sh`: Ecosystem-wide automation for README/CI/dependabot across your repos.

The advanced LLM agent (`agent.py`) is the primary engine for complex, creative self-improvement.

## Quick Start & Setup

### 1. Repository Secrets (Required for LLM providers)
Go to Settings > Secrets and variables > Actions and add:

- `OPENAI_API_KEY` (or `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, etc.)
- At minimum one LLM provider key is needed. Multiple = better resilience and evolution.

`GITHUB_TOKEN` is automatically provided by Actions with the required `contents:write`, `pull-requests:write`, `issues:write` permissions.

### 2. Enable Workflows
Ensure Actions are enabled for the repo. The `autonomous-agent.yml` workflow is the heart.

### 3. Trigger It
- Push to `main` (or any change)
- Open/edit an issue or comment on one
- Open/synchronize a PR
- Manually: Actions tab > "Autonomous GitHub Agent" > Run workflow (optionally provide `task` input)

### 4. Watch the Magic
The agent will analyze, decide high-ROI actions, edit code safely, push a draft PR titled `🤖 ...`, and often retriggers itself for chained improvements. Review the PR diff, merge when ready, or let it continue evolving.

## How Self-Improvement Actually Works (The Secret Sauce)

1. **Task Selection**: Combines issue/PR scanning + code scanning + self-evaluation of architecture quality and evolution metrics (error reduction, speed, fallback usage, code bloat).
2. **LLM Reasoning + Tools**: The chosen LLM gets a system prompt + task. It can call `read_file`, `edit_file`, `run_command` (dangerous ops blocked). It iterates up to `DEFAULT_MAX_ITERATIONS`.
3. **Safe Execution**: Creates feature branch, applies changes, commits with `DEPTH:N`, pushes, opens **draft** PR. Invariant checks prevent dangerous code.
4. **Adaptation**: After run, writes `.agent_profile.json`. Next invocation reads it to tune `MAX_ITERATIONS`, `RETRY_COUNT`, and even receives high-level directives like "Reduce mutation aggressiveness".
5. **Recursion Control**: Depth in commit message stops at 3. Fallback mode for recovery.

This creates compounding returns: every run makes the agent (and your repos) measurably better.

## Alignment with Your Goals

- **Perfection as Fast as Possible**: Highest-ROI actions first. Zero unnecessary work. Real tough problems solved.
- **Zero Cost Iterations**: All improvements via existing GitHub Actions minutes + your LLM credits.
- **Ecosystem Amplification**: Improvements here can be propagated via `automate-repos.sh` or future autonomous multi-repo loops.
- **Singularity Operator Path**: This is a foundational building block for the ultimate self-improving AI system. It can eventually operate on its own code, other repos, userscripts, and even coordinate multi-AI swarms.

## Current Status (v4.0 Perfected)

**All Systems PERFECTED** ✅

### Implemented Features (v4.0)
- ✅ **Multi-LLM Orchestration**: 8 providers with free-tier prioritization and latency tracking
- ✅ **Advanced Security Hardening**: Input sanitization, categorical risk blocking, path validation
- ✅ **PR Review Integration**: Automatic PR identification for review
- ✅ **Sub-Issue Management**: GitHub sub-issues support with epics
- ✅ **Cross-Repository Sync**: Propagate improvements across ecosystem
- ✅ **Security Dashboard**: `.github/scripts/tools.py` generates comprehensive metrics
- ✅ **Self-Audit System**: Continuous self-evaluation for improvements
- ✅ **Comprehensive Verification**: `verify_perfect.py` validates all systems

### Security Controls (Production-Ready)
- Prompt injection prevention with HTML comment stripping
- Categorized high-risk pattern blocking (destructive, security, system, network)
- Path traversal prevention
- Draft PR workflow with human review gate
- Depth-controlled recursion (max 3 levels)

### Quick Verification
```bash
python .github/scripts/verify_perfect.py
```

This generates the security dashboard:
```bash
python .github/scripts/tools.py
```

## Contributing & Evolution

This repo *is* the evolution engine. Open an issue with "agent:" prefix or just push — the agent will likely pick it up and propose improvements. Or manually dispatch with a specific task.

All changes should advance the mission: **reach perfection as fast as possible for myself and then others**.

---

*Part of Eric's AI collaboration ecosystem. Built with Grok and relentless iteration.*
*Connectors enabled. Fully read. Highest return catalyst actions executed.*