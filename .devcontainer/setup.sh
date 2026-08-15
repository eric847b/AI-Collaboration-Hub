#!/bin/bash
set -e

echo "🚀 Setting up development environment..."

# Update package manager
apt-get update
apt-get install -y --no-install-recommends \
  build-essential \
  curl \
  git \
  jq \
  postgresql-client \
  redis-tools

# Install Node dependencies
echo "📦 Installing Node dependencies..."
npm install -g npm@latest pnpm yarn

# Install Python dependencies
echo "🐍 Setting up Python..."
python3 -m pip install --upgrade pip setuptools wheel
pip install black flake8 mypy pytest pytest-cov pdoc safety

# Bootstrap workspace
echo "🔧 Bootstrapping workspace..."
if [ -f "tools/bootstrap.ps1" ]; then
  bash tools/bootstrap.ps1 2>/dev/null || true
fi

# Install pre-commit hooks
echo "🔗 Installing pre-commit hooks..."
if command -v husky &> /dev/null; then
  husky install
fi

echo "✅ Development environment ready!"
echo ""
echo "Quick start commands:"
echo "  npm run bootstrap  - Install all dependencies"
echo "  npm run health     - Check workspace health"
echo "  npm run verify     - Verify all configurations"
echo ""
