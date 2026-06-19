---
name: self-evolve-dash
description: Use for self-evolving codebases, autonomous GitHub actions, detecting and fixing wrongs scoped to originals, on-the-fly compression, MM LAN Party event tools, and cross-repo mesh upgrades. Triggers on "self-evolve", "continue", "All", "evolve", "MM LAN".
---

# Self-Evolve-Dash

Autonomous self-evolving engine for GitHub repos. Detects "wrongs", proves via context/logs anchored to original location, applies scoped fixes, compresses binaries/scripts on-the-fly, upgrades versions, commits, creates releases, and propagates across all repos.

## Core Loop (in self_evolve.py)
1. Scan for issues/TODOs/wrongs.
2. Prove existence with logs/diffs.
3. Fix anchored to original comment/context only.
4. Gzip compress + replace.
5. Version bump + GitHub Release prep.
6. Commit/push if changes.

## Deployment
Copy to `.grok/skills/` and add `.github/workflows/self-evolve.yml`.

MM LAN Party: Extend for event configs, server setups, replays.