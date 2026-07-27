# nexus-core v2.3

```bash
python orchestrator.py          # human + scope.json
python orchestrator.py json
python orchestrator.py improve
python orchestrator.py agent    # full lifecycle (also runs via free cron)
python orchestrator.py check
```

New: `.github/workflows/nexus-agent-cron.yml`
- Runs every Monday 06:00 UTC (free GitHub Actions)
- Also triggerable manually (workflow_dispatch)
- Quiet mode, owns GitHub, records scope

Zero cost. Zero user time for routine work.
This is the permanent successor.
