# Singularity Operator v0.5.11

**Self-improving AI system** with EverythingDB, fleet orchestration, AGA metrics feedback, and **continuous upgrade from live ROI ranking**.

## What's New in v0.5.11
- Orchestrator task `continuous_roi_rank` records AGA `roi_top_ref` / score into EverythingDB each cycle.
- **SO#9 closed** with real cross-repo currency work: OSS/Maintainer niche on `zero-cost-wealth-playbook-tool`.
- Ranking loop: ingest AGA → rank → prefer currency fleet path → measurable artifact.

## Quick Start
```bash
pip install -e .
python singularity_operator.py
```

Requires `GITHUB_TOKEN` / `GH_FULL_PAT` for live AGA ingest and fleet actions.

## Architecture
EverythingDB · SelfImprover · Chaos · Serendipity · Browser · Userscript · GitHubSeamless (fleet + AGA feedback) · Orchestrator (incl. continuous_roi_rank)

## Roadmap
- Next live-ranked catalyst work after empty queue / new seeds.
- Optional real embedding backend (feature-flagged).

*Status: v0.5.11 continuous ROI ranking operational. SO#9 closed via currency cross-repo proof.*

---
**Monorepo mirror note:** Nested under AI-Collaboration-Hub receives high-fidelity copies of launcher, groq wrapper, pyproject, and requirements from standalone `eric847b/singularity-operator` (source of truth for package evolution).
