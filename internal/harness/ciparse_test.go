package harness

import (
	"os"
	"path/filepath"
	"testing"
)

// --- GitHub Actions ---

func TestParseCI_GitHubActions_Simple(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)

	writeFile(t, wfDir, "ci.yml", `
name: CI
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Build
        run: go build ./...
      - name: Test
        run: go test ./...
  lint:
    runs-on: ubuntu-latest
    steps:
      - name: Lint
        run: golangci-lint run
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, "go build ./...")
	assertEqual(t, "Test", cmds.Test, "go test ./...")
	assertEqual(t, "Lint", cmds.Lint, "golangci-lint run")
}

func TestParseCI_GitHubActions_MultiLine(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)

	writeFile(t, wfDir, "ci.yml", `
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test with Coverage
        run: |
          set -o pipefail
          gotestsum --format testname -- -race -short ./... 2>&1 | tee test-output.txt
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Test", cmds.Test, "gotestsum --format testname -- -race -short ./...")
}

func TestParseCI_GitHubActions_SkipsSetup(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)

	writeFile(t, wfDir, "ci.yml", `
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Install deps
        run: apt-get install -y libicu-dev
      - name: Build
        run: go build ./...
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, "go build ./...")
	assertEqual(t, "Setup", cmds.Setup, "apt-get install -y libicu-dev")
}

func TestParseCI_GitHubActions_Typecheck(t *testing.T) {
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)

	writeFile(t, wfDir, "ci.yml", `
name: CI
on: push
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - name: Typecheck
        run: tsc --noEmit
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Typecheck", cmds.Typecheck, "tsc --noEmit")
}

// --- Makefile ---

func TestParseCI_Makefile(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "Makefile", `
.PHONY: build test lint

build:
	go build -ldflags "$(LDFLAGS)" -o gt ./cmd/gt

test:
	go test -race ./...

lint:
	golangci-lint run --timeout=5m
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, `go build -ldflags "$(LDFLAGS)" -o gt ./cmd/gt`)
	assertEqual(t, "Test", cmds.Test, "go test -race ./...")
	assertEqual(t, "Lint", cmds.Lint, "golangci-lint run --timeout=5m")
}

func TestParseCI_Makefile_SkipsComments(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "Makefile", `
test:
	# Run the test suite
	@echo "Running tests..."
	go test ./...
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Test", cmds.Test, "go test ./...")
}

// --- package.json ---

func TestParseCI_PackageJSON(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "package.json", `{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}`)

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, "npm run build")
	assertEqual(t, "Test", cmds.Test, "npm test")
	assertEqual(t, "Lint", cmds.Lint, "npm run lint")
	assertEqual(t, "Typecheck", cmds.Typecheck, "npm run typecheck")
	assertEqual(t, "Setup", cmds.Setup, "npm install")
}

func TestParseCI_PackageJSON_Pnpm(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "package.json", `{"scripts":{"test":"vitest"}}`)
	writeFile(t, dir, "pnpm-lock.yaml", "")

	cmds := ParseCI(dir)
	assertEqual(t, "Test", cmds.Test, "pnpm test")
	assertEqual(t, "Setup", cmds.Setup, "pnpm install")
}

func TestParseCI_PackageJSON_Yarn(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "package.json", `{"scripts":{"build":"webpack"}}`)
	writeFile(t, dir, "yarn.lock", "")

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, "yarn run build")
	assertEqual(t, "Setup", cmds.Setup, "yarn install")
}

// --- Priority ---

func TestParseCI_GitHubActionsPriority(t *testing.T) {
	// GitHub Actions should take priority over Makefile and package.json.
	dir := t.TempDir()
	wfDir := filepath.Join(dir, ".github", "workflows")
	os.MkdirAll(wfDir, 0755)

	writeFile(t, wfDir, "ci.yml", `
name: CI
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Test
        run: go test -race ./...
`)
	writeFile(t, dir, "Makefile", `
test:
	go test ./...
`)

	cmds := ParseCI(dir)
	// Should get the GH Actions version (with -race), not Makefile.
	assertEqual(t, "Test", cmds.Test, "go test -race ./...")
}

func TestParseCI_FallsBackToMakefile(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, dir, "Makefile", `
build:
	cargo build --release
test:
	cargo test
`)

	cmds := ParseCI(dir)
	assertEqual(t, "Build", cmds.Build, "cargo build --release")
	assertEqual(t, "Test", cmds.Test, "cargo test")
}

func TestParseCI_Empty(t *testing.T) {
	dir := t.TempDir()
	cmds := ParseCI(dir)
	if cmds != (Commands{}) {
		t.Errorf("expected zero Commands for empty dir, got %+v", cmds)
	}
}

// --- helpers ---

func writeFile(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func assertEqual(t *testing.T, field, got, want string) {
	t.Helper()
	if got != want {
		t.Errorf("%s = %q, want %q", field, got, want)
	}
}
