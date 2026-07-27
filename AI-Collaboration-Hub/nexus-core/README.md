# nexus-core v1.6

```bash
python orchestrator.py          # live health scope
python orchestrator.py improve
python orchestrator.py agent    # launch autonomous-github-agent (quiet)
python orchestrator.py check
```

Default executor = autonomous-github-agent with quiet failure handler.
Notifications are batch-marked read; only critical failures surface.
Canonical registry. CI enforced. This is the permanent successor.
