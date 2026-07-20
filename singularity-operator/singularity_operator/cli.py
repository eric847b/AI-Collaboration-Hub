#!/usr/bin/env python3
"""CLI for Singularity Operator v0.3 - Easy entrypoint for autonomous runs, userscript gen, metrics."""

import argparse
import os
from .orchestrator import SingularityOrchestrator
from .groq_wrapper import GroqWrapper

def main():
    parser = argparse.ArgumentParser(description="Singularity Operator - Implement all to next setpoint")
    parser.add_argument("--autonomous", action="store_true", help="Start full autonomous orchestration loop")
    parser.add_argument("--userscript", type=str, default="", help="Generate userscript with prompt")
    parser.add_argument("--metrics", action="store_true", help="Show current metrics")
    parser.add_argument("--interval", type=int, default=300, help="Autonomous loop interval seconds")
    args = parser.parse_args()

    orch = SingularityOrchestrator()
    gw = GroqWrapper()

    if args.autonomous:
        print(orch.start_full_autonomous(interval=args.interval))
        print("Running... (Ctrl+C to stop)")
        try:
            while True:
                import time; time.sleep(10)
        except KeyboardInterrupt:
            orch.stop()
    elif args.userscript:
        script = orch.generate_userscript(args.userscript)
        print(script)
        with open("singularity_userscript.user.js", "w") as f:
            f.write(script)
        print("Saved to singularity_userscript.user.js")
    elif args.metrics:
        print("Orchestrator metrics:", orch.metrics)
        print("GroqWrapper metrics:", gw.get_metrics())
    else:
        print("Singularity Operator v0.3 CLI ready. Use --help for options.")
        print("Example: python -m singularity_operator.cli --autonomous --interval 60")

if __name__ == "__main__":
    main()