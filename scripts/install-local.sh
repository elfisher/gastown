#!/bin/bash
set -e

# Build gt from source
echo "🔨 Building gt..."
cd "$(dirname "$0")"
go build -o gt ./cmd/gt

# Install stable copy to PATH
echo "📦 Installing gt to /opt/homebrew/bin/gt..."
cp gt /opt/homebrew/bin/gt

echo "✅ Installed: $(gt version)"
echo ""
echo "Usage:"
echo "  gt          — runs stable installed build"
echo "  ./gt        — runs local dev build (after go build -o gt ./cmd/gt)"
