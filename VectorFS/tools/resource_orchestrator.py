#!/usr/bin/env python3
"""Autonomous free-tier resource orchestration.

This module provides a small, dependency-free scheduler that picks the
next best free-to-use resource based on:
- remaining budget (credits/tokens/requests)
- observed quality score
- observed latency
- cost (must be zero for autonomous mode)

It also tracks each usage event and auto-expands the pool with additional
free resources when configured budgets become low.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Dict, Iterable, List, Optional


@dataclass(frozen=True)
class Resource:
    """A compute/API resource used by autonomous workflows."""

    name: str
    resource_type: str
    free_tier: bool = True
    unit: str = "tokens"
    low_watermark: float = 0.15
    latency_ms: float = 500.0
    quality_score: float = 0.7
    cost_per_unit: float = 0.0


@dataclass
class ResourceBudget:
    """Mutable usage accounting for a resource."""

    limit: float
    used: float = 0.0

    @property
    def remaining(self) -> float:
        return max(self.limit - self.used, 0.0)

    @property
    def ratio_remaining(self) -> float:
        if self.limit <= 0:
            return 0.0
        return self.remaining / self.limit

    def consume(self, amount: float) -> None:
        if amount < 0:
            raise ValueError("amount must be non-negative")
        self.used += amount


@dataclass
class UsageEvent:
    timestamp: str
    resource: str
    amount: float
    unit: str
    task: str
    decision_reason: str


@dataclass
class OrchestratorState:
    resources: Dict[str, Resource] = field(default_factory=dict)
    budgets: Dict[str, ResourceBudget] = field(default_factory=dict)
    history: List[UsageEvent] = field(default_factory=list)


class ResourceOrchestrator:
    """Select and track free/no-cost resources for autonomous development."""

    def __init__(self, state: Optional[OrchestratorState] = None):
        self.state = state or OrchestratorState()

    def register(self, resource: Resource, limit: float, used: float = 0.0) -> None:
        self.state.resources[resource.name] = resource
        self.state.budgets[resource.name] = ResourceBudget(limit=limit, used=used)

    def candidate_names(self) -> List[str]:
        return [
            name
            for name, resource in self.state.resources.items()
            if resource.free_tier and resource.cost_per_unit <= 0.0
        ]

    def select_next_resource(self, task: str) -> Resource:
        candidates = self.candidate_names()
        if not candidates:
            raise RuntimeError("No free/no-cost resources are registered")

        def score(name: str) -> float:
            resource = self.state.resources[name]
            budget = self.state.budgets[name]

            remaining_score = budget.ratio_remaining
            quality_score = resource.quality_score
            latency_score = 1.0 / max(resource.latency_ms, 1.0)
            return (remaining_score * 0.55) + (quality_score * 0.35) + (latency_score * 0.10)

        best_name = max(candidates, key=score)
        return self.state.resources[best_name]

    def _reason_for(self, name: str) -> str:
        resource = self.state.resources[name]
        budget = self.state.budgets[name]
        return (
            f"selected={name}; remaining={budget.remaining:.2f}/{budget.limit:.2f} {resource.unit}; "
            f"quality={resource.quality_score:.2f}; latency_ms={resource.latency_ms:.0f}"
        )

    def record_usage(self, resource_name: str, amount: float, task: str) -> UsageEvent:
        if resource_name not in self.state.resources:
            raise KeyError(f"Unknown resource: {resource_name}")

        budget = self.state.budgets[resource_name]
        budget.consume(amount)

        resource = self.state.resources[resource_name]
        event = UsageEvent(
            timestamp=datetime.now(tz=timezone.utc).isoformat(),
            resource=resource_name,
            amount=amount,
            unit=resource.unit,
            task=task,
            decision_reason=self._reason_for(resource_name),
        )
        self.state.history.append(event)
        return event

    def low_budget_resources(self) -> List[str]:
        names: List[str] = []
        for name, resource in self.state.resources.items():
            budget = self.state.budgets[name]
            if budget.ratio_remaining <= resource.low_watermark:
                names.append(name)
        return names

    def auto_expand_free_pool(self, additional: Iterable[Resource], default_limit: float = 10000.0) -> List[str]:
        """Add new free resources when current pool is near depletion."""
        if not self.low_budget_resources():
            return []

        added: List[str] = []
        for resource in additional:
            if not resource.free_tier or resource.cost_per_unit > 0:
                continue
            if resource.name in self.state.resources:
                continue
            self.register(resource, limit=default_limit, used=0.0)
            added.append(resource.name)
        return added

    def snapshot(self) -> Dict[str, object]:
        return {
            "resources": {
                name: {
                    "type": resource.resource_type,
                    "free_tier": resource.free_tier,
                    "unit": resource.unit,
                    "low_watermark": resource.low_watermark,
                    "latency_ms": resource.latency_ms,
                    "quality_score": resource.quality_score,
                    "cost_per_unit": resource.cost_per_unit,
                }
                for name, resource in self.state.resources.items()
            },
            "budgets": {
                name: {
                    "limit": budget.limit,
                    "used": budget.used,
                    "remaining": budget.remaining,
                    "ratio_remaining": budget.ratio_remaining,
                }
                for name, budget in self.state.budgets.items()
            },
            "history": [event.__dict__ for event in self.state.history],
        }


def write_snapshot(path: Path, data: Dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def demo() -> None:
    orchestrator = ResourceOrchestrator()
    orchestrator.register(
        Resource(name="local-llm", resource_type="model", unit="tokens", latency_ms=1600, quality_score=0.72),
        limit=2_000_000,
        used=1_810_000,
    )
    orchestrator.register(
        Resource(name="free-ci", resource_type="compute", unit="minutes", latency_ms=800, quality_score=0.63),
        limit=2_000,
        used=1_400,
    )

    selected = orchestrator.select_next_resource(task="next-highest-value")
    orchestrator.record_usage(selected.name, amount=1500, task="next-highest-value")

    added = orchestrator.auto_expand_free_pool(
        additional=[
            Resource(name="community-inference", resource_type="model", unit="tokens", latency_ms=2200, quality_score=0.68),
            Resource(name="oss-runner", resource_type="compute", unit="minutes", latency_ms=1200, quality_score=0.58),
        ],
        default_limit=500_000,
    )

    snapshot = orchestrator.snapshot()
    snapshot["auto_added_resources"] = added
    write_snapshot(Path("runtime/resource_ledger.json"), snapshot)


if __name__ == "__main__":
    demo()
