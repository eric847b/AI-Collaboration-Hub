# Cline Continuous Improvement Configuration

## How to Run Continuously

1. **Open Cline in VS Code** on this workspace
2. **Use this prompt** to start the continuous loop:

```
Run the autonomous continuous improvement cycle:
1. Run `npm run health` and fix any issues found
2. Run TypeScript strict checks on nexus-infinity-hub and self-evolve-dash
3. Fix any type errors, unused imports, or lint issues
4. Run tests and fix failures
5. Check for security vulnerabilities (npm audit)
6. Commit and push improvements to the current branch
7. Create a PR if on a feature branch
8. Repeat every 30 minutes
```

## Automation Options

### Option 1: VS Code Task (Recommended)
Add to `.vscode/tasks.json`:
```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Cline: Continuous Improvement",
      "type": "shell",
      "command": "echo 'Open Cline and paste the continuous improvement prompt'",
      "problemMatcher": []
    }
  ]
}
```

### Option 2: GitHub Actions (Already Configured)
The `.github/workflows/autonomous-agent.yml` now runs every 6 hours automatically.

### Option 3: Manual Loop
Run this in a terminal every 30 min:
```bash
npm run health && npm run verify
```

## What Gets Improved Automatically
- TypeScript strict mode compliance
- Unused imports/variables removal
- Lint and formatting fixes
- Test coverage
- Security vulnerabilities
- Lockfile consistency
- CI workflow health