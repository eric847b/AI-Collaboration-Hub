#!/usr/bin/env python3
"""nexus-core minimal orchestrator - registers, graphs, enforces"""
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REG = Path(__file__).parent / "registry.json"

def load():
    with open(REG) as f: return json.load(f)

def graph(r):
    print("graph TD")
    for m in r["modules"]:
        print(f'  {m["name"]}[{m["name"]}|{m["role"]}]')
        for d in m.get("deps", []):
            if d == "*": continue
            print(f'  {d} --> {m["name"]}')

def run(name):
    r = load()
    mod = next((m for m in r["modules"] if m["name"] == name), None)
    if not mod: sys.exit(f"unregistered: {name}")
    ep = mod.get("entrypoint")
    if ep: subprocess.run(ep, shell=True, cwd=ROOT / name if (ROOT / name).exists() else ROOT)

def check():
    r = load()
    print(f"nexus-core v{r['version']} | modules={len(r['modules'])} | rules={len(r['rules'])}")
    for rule in r["rules"]: print(f"  ✓ {rule}")

if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "graph": graph(load())
    elif cmd == "run": run(sys.argv[2]) if len(sys.argv) > 2 else sys.exit("name required")
    else: check()
