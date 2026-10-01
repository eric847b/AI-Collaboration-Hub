# telemetry/ — fleet-side git inbox

Ephemeral GitHub Actions runners cannot host a persistent HTTP endpoint, so
the fleet's telemetry transport is **git**:

1. **Hub side** — `node tools/telemetry-export.mjs sync-fleet --into <this repo>/telemetry/inbox --commit`
   groups the collector sink into one `{appId, version, sentAt, entries[]}`
   batch per app and writes `telemetry-<stamp>-<n>events.json` here. Pushing
   this repo is always done via `resilient-git.ps1 sync`, never from the tool.
2. **Fleet side** — `.github/workflows/telemetry-intake.yml` runs
   `.github/agent_telemetry_intake.mjs`, which ingests each batch through the
   mirrored `.github/telemetry_collector.mjs` (the hub's validator, rate
   limiter, dedupe and JSONL sink, byte-mirrored via `tools/parity-map.json`)
   into `telemetry/sink.jsonl`, then:
   - `telemetry/ingested/` — archived shipments (the audit trail, one file per
     batch, name-ordered), never re-counted;
   - `telemetry/rejected/` — parked failures, each with a `.reason.txt`.

Nothing here is secret: batches contain app ids, timestamps, error messages
and route paths only. The mirrored collector and intake script are owned by
the hub's `tools/` telemetry pair — edit them there and re-run
`node tools/sync-parity.mjs sync`, not here.
