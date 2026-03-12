#!/bin/bash
set -e

# Rebuild and install gt from local source
# Run after making code changes

cd "$(dirname "$0")/.."

echo "🔨 Building gt..."
go build -o gt ./cmd/gt

echo "📦 Installing to /opt/homebrew/bin/gt..."
cp gt /opt/homebrew/bin/gt

echo "✅ Installed: $(gt version 2>&1 | head -1)"
echo ""
echo "  gt     — runs stable installed build"
echo "  ./gt   — runs local dev build (after go build -o gt ./cmd/gt)"
