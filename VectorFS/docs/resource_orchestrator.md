# Autonomous Free-Resource Orchestration

This document describes the next highest-value automation step for VectorFS development:
autonomous routing across free/no-cost resources with explicit budget tracking.

## Goals

- Prefer **free-tier resources** for development and validation tasks.
- Track **where, when, and why** each resource was used.
- Switch to additional free resources when any tracked budget approaches depletion.

## Implementation

The reference implementation lives in `tools/resource_orchestrator.py` and includes:

- A `Resource` model with quality/latency/cost metadata.
- A `ResourceBudget` model that tracks limit, used, and remaining ratios.
- A `ResourceOrchestrator` that:
  - selects the next free/no-cost resource using a weighted score,
  - records every usage event with UTC timestamp + decision rationale,
  - auto-expands the free resource pool when budgets are below low-watermark.

## Operational Flow

1. Register known free resources and their budgets.
2. Select resource for the next highest-value task.
3. Record consumption by unit (`tokens`, `minutes`, etc.).
4. Detect low-budget resources.
5. Add additional free resources to maintain continuity.
6. Persist a resource ledger (`runtime/resource_ledger.json`) for auditing.

## Default Policy

Scoring (higher is better):

- 55% remaining budget ratio
- 35% observed quality score
- 10% inverse latency

This biases for runway while still preferring higher quality.

## Example

Run:

```bash
python3 tools/resource_orchestrator.py
```

Output:

- Generates/updates `runtime/resource_ledger.json`.
- Includes `history` entries with timestamps, task names, and decision reasons.
- Includes `auto_added_resources` when low-budget thresholds were triggered.
