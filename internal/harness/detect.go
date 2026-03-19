// Package harness provides convention-based project detection for verification contracts.
package harness

import (
	"os"
	"path/filepath"
)

// Commands holds the default tier0 verification commands for a detected project type.
type Commands struct {
	Build     string
	Test      string
	Lint      string
	Typecheck string
	Setup     string
}

// DetectCommands scans root for project marker files and returns default tier0 commands.
// Returns zero-value Commands if no known project type is detected.
func DetectCommands(root string) Commands {
	switch {
	case fileExists(root, "go.mod"):
		return Commands{
			Build: "go build ./...",
			Test:  "go test ./...",
			Lint:  "golangci-lint run",
		}
	case fileExists(root, "package.json"):
		cmds := Commands{
			Build:     "npm run build",
			Test:      "npm test",
			Lint:      "npm run lint",
			Typecheck: "tsc --noEmit",
		}
		if fileExists(root, "pnpm-lock.yaml") {
			cmds.Setup = "pnpm install"
		} else if fileExists(root, "yarn.lock") {
			cmds.Setup = "yarn install"
		} else {
			cmds.Setup = "npm install"
		}
		return cmds
	case fileExists(root, "Cargo.toml"):
		return Commands{
			Build: "cargo build",
			Test:  "cargo test",
			Lint:  "cargo clippy",
		}
	case fileExists(root, "Makefile"):
		return Commands{
			Build: "make build",
			Test:  "make test",
		}
	default:
		return Commands{}
	}
}

func fileExists(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}
