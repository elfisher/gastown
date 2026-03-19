package harness

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectCommands_Go(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "go.mod")

	cmds := DetectCommands(dir)
	if cmds.Build != "go build ./..." {
		t.Errorf("Build = %q, want %q", cmds.Build, "go build ./...")
	}
	if cmds.Test != "go test ./..." {
		t.Errorf("Test = %q, want %q", cmds.Test, "go test ./...")
	}
	if cmds.Lint != "golangci-lint run" {
		t.Errorf("Lint = %q, want %q", cmds.Lint, "golangci-lint run")
	}
	if cmds.Typecheck != "" {
		t.Errorf("Typecheck = %q, want empty", cmds.Typecheck)
	}
}

func TestDetectCommands_Node_pnpm(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "package.json")
	touch(t, dir, "pnpm-lock.yaml")

	cmds := DetectCommands(dir)
	if cmds.Build != "npm run build" {
		t.Errorf("Build = %q", cmds.Build)
	}
	if cmds.Setup != "pnpm install" {
		t.Errorf("Setup = %q, want %q", cmds.Setup, "pnpm install")
	}
	if cmds.Typecheck != "tsc --noEmit" {
		t.Errorf("Typecheck = %q, want %q", cmds.Typecheck, "tsc --noEmit")
	}
}

func TestDetectCommands_Node_yarn(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "package.json")
	touch(t, dir, "yarn.lock")

	cmds := DetectCommands(dir)
	if cmds.Setup != "yarn install" {
		t.Errorf("Setup = %q, want %q", cmds.Setup, "yarn install")
	}
}

func TestDetectCommands_Node_npm(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "package.json")

	cmds := DetectCommands(dir)
	if cmds.Setup != "npm install" {
		t.Errorf("Setup = %q, want %q", cmds.Setup, "npm install")
	}
}

func TestDetectCommands_Rust(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "Cargo.toml")

	cmds := DetectCommands(dir)
	if cmds.Build != "cargo build" {
		t.Errorf("Build = %q", cmds.Build)
	}
	if cmds.Test != "cargo test" {
		t.Errorf("Test = %q", cmds.Test)
	}
	if cmds.Lint != "cargo clippy" {
		t.Errorf("Lint = %q", cmds.Lint)
	}
}

func TestDetectCommands_Makefile(t *testing.T) {
	dir := t.TempDir()
	touch(t, dir, "Makefile")

	cmds := DetectCommands(dir)
	if cmds.Build != "make build" {
		t.Errorf("Build = %q", cmds.Build)
	}
	if cmds.Test != "make test" {
		t.Errorf("Test = %q", cmds.Test)
	}
}

func TestDetectCommands_Empty(t *testing.T) {
	dir := t.TempDir()

	cmds := DetectCommands(dir)
	if cmds != (Commands{}) {
		t.Errorf("expected zero Commands for empty dir, got %+v", cmds)
	}
}

func TestDetectCommands_Priority(t *testing.T) {
	// go.mod takes priority over Makefile
	dir := t.TempDir()
	touch(t, dir, "go.mod")
	touch(t, dir, "Makefile")

	cmds := DetectCommands(dir)
	if cmds.Build != "go build ./..." {
		t.Errorf("go.mod should take priority, got Build = %q", cmds.Build)
	}
}

func touch(t *testing.T, dir, name string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), nil, 0644); err != nil {
		t.Fatal(err)
	}
}
