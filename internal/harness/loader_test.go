package harness

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadHarness_MissingFile(t *testing.T) {
	tiers, err := LoadHarness(t.TempDir())
	if err != nil {
		t.Fatalf("expected nil error for missing file, got: %v", err)
	}
	if tiers != nil {
		t.Fatalf("expected nil tiers for missing file, got: %v", tiers)
	}
}

func TestLoadHarness_ValidConfig(t *testing.T) {
	dir := t.TempDir()
	harnessDir := filepath.Join(dir, ".gastown")
	if err := os.MkdirAll(harnessDir, 0o755); err != nil {
		t.Fatal(err)
	}
	yaml := `tier0:
  - go build ./...
  - go vet ./...
tier1:
  - go test ./...
`
	if err := os.WriteFile(filepath.Join(harnessDir, "harness.yaml"), []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}

	tiers, err := LoadHarness(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tiers) != 2 {
		t.Fatalf("expected 2 tiers, got %d", len(tiers))
	}
	if len(tiers[0]) != 2 {
		t.Fatalf("expected 2 tier0 commands, got %d", len(tiers[0]))
	}
	if len(tiers[1]) != 1 {
		t.Fatalf("expected 1 tier1 command, got %d", len(tiers[1]))
	}
}

func TestLoadHarness_Tier0Only(t *testing.T) {
	dir := t.TempDir()
	harnessDir := filepath.Join(dir, ".gastown")
	if err := os.MkdirAll(harnessDir, 0o755); err != nil {
		t.Fatal(err)
	}
	yaml := `tier0:
  - make build
`
	if err := os.WriteFile(filepath.Join(harnessDir, "harness.yaml"), []byte(yaml), 0o644); err != nil {
		t.Fatal(err)
	}

	tiers, err := LoadHarness(dir)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tiers) != 1 {
		t.Fatalf("expected 1 tier, got %d", len(tiers))
	}
}

func TestLoadHarness_MalformedYAML(t *testing.T) {
	dir := t.TempDir()
	harnessDir := filepath.Join(dir, ".gastown")
	if err := os.MkdirAll(harnessDir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(harnessDir, "harness.yaml"), []byte("{{invalid"), 0o644); err != nil {
		t.Fatal(err)
	}

	_, err := LoadHarness(dir)
	if err == nil {
		t.Fatal("expected error for malformed YAML")
	}
}
