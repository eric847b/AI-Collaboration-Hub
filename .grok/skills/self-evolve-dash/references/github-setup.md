# GitHub Workflow Template

name: Self-Evolve-Dash
on: [push, issues, schedule]
jobs:
  evolve:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: python .grok/skills/self-evolve-dash/scripts/self_evolve.py
      - uses: stefanzweifel/git-auto-commit-action@v5