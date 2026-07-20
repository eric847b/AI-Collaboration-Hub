import unittest

from tools.resource_orchestrator import Resource, ResourceOrchestrator


class ResourceOrchestratorTests(unittest.TestCase):
    def test_select_prefers_more_budget_and_quality(self):
        o = ResourceOrchestrator()
        o.register(Resource(name="a", resource_type="model", quality_score=0.5, latency_ms=1000), limit=1000, used=900)
        o.register(Resource(name="b", resource_type="model", quality_score=0.8, latency_ms=1200), limit=1000, used=100)
        self.assertEqual(o.select_next_resource("task").name, "b")

    def test_auto_expand_when_low_budget(self):
        o = ResourceOrchestrator()
        o.register(Resource(name="primary", resource_type="model", low_watermark=0.2), limit=1000, used=900)
        added = o.auto_expand_free_pool([
            Resource(name="backup", resource_type="model", free_tier=True, cost_per_unit=0.0)
        ], default_limit=500)
        self.assertEqual(added, ["backup"])


if __name__ == "__main__":
    unittest.main()
