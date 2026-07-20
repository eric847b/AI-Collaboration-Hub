# Autonomous GitHub Agent - Completed Data Set
# Thee Infallable Standard Implementation

## Free AI Provider Priority Order (Zero-Cost First)
1. GitHub Models (uses GITHUB_TOKEN automatically)
2. DeepSeek API (free tier)
3. Ollama (local, no API key needed)
4. HuggingFace (free inference API)
5. OpenRouter (free models like gemma-7b-it:free)
6. Google Gemini (free tier)

## Required Secrets for GitHub Actions
- DEEPSEEK_API_KEY (optional - free)
- HF_API_KEY or HF_TOKEN (optional - free)
- OPENROUTER_API_KEY (optional - free)
- OPENAI_API_KEY (optional - paid fallback)
- ANTHROPIC_API_KEY (optional - paid fallback)
- GEMINI_API_KEY (optional - free/paid)

## Environment Variables for Local/RunPod/Ollama
- GITHUB_TOKEN (auto-provided by Actions)
- OLLAMA_HOST (optional - defaults to localhost:11434)

## Self-Evolution Features
- Depth control prevents runaway loops
- Profile tracking in .agent_profile.json
- Branch cleanup on every run
- Security hardening v3.1
- Graceful degradation when LLMs unavailable

## Deployment Verification
```bash
python -m py_compile .github/scripts/agent.py && echo "Perfect: Syntax Valid"
```

## Next-Level Evolution Triggers
- Create issue with "agent:" prefix for self-improvement tasks
- Push to main triggers autonomous scan
- Manual workflow_dispatch with custom task input