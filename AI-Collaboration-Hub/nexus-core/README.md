# nexus-core v1.7

```bash
python orchestrator.py          # human + writes scope.json
python orchestrator.py json     # machine-only JSON
python orchestrator.py improve
python orchestrator.py agent    # quiet autonomous executor
python orchestrator.py check
```

Machine-readable scope.json is always produced.
Quiet agent absorbs runtime/test failures before notifications.
Canonical. CI enforced. This is the permanent successor.
