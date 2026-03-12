#!/bin/bash
set -e

# One-time setup for Gas Town development
# Run this on a fresh machine to install all dependencies

echo "🔧 Gas Town Development Setup"
echo ""

# Check for Homebrew
if ! command -v brew &>/dev/null; then
  echo "❌ Homebrew not found. Install it first:"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  exit 1
fi

# Install system deps
echo "📦 Installing system dependencies..."
brew install go git tmux dolt

# Fix corporate proxy issue
echo "🔧 Setting GOPROXY=direct (bypasses blocked proxy.golang.org)..."
go env -w GOPROXY=direct

# Install beads
echo "📦 Installing beads CLI..."
go install github.com/steveyegge/beads/cmd/bd@latest

# Ensure ~/go/bin is in PATH
if ! echo "$PATH" | grep -q "$HOME/go/bin"; then
  echo ""
  echo "⚠️  ~/go/bin is not in your PATH. Add this to your ~/.zshrc:"
  echo '  export PATH="$PATH:$HOME/go/bin"'
  echo ""
fi

# Build and install gt from source
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "🔨 Building gt from source..."
cd "$REPO_ROOT"
go build -o gt ./cmd/gt
cp gt /opt/homebrew/bin/gt

# Verify
echo ""
echo "✅ Setup complete. Versions:"
echo "  go:    $(go version | awk '{print $3}')"
echo "  git:   $(git --version | awk '{print $3}')"
echo "  dolt:  $(dolt version | awk '{print $3}')"
echo "  bd:    $(bd version 2>&1 | head -1)"
echo "  tmux:  $(tmux -V)"
echo "  gt:    $(gt version 2>&1 | grep -o 'v[0-9.]*')"
echo ""
echo "Next steps:"
echo "  gt install ~/gt --shell"
echo "  cd ~/gt"
echo "  gt enable"
echo "  gt git-init"
echo "  gt up"
echo "  gt doctor"
