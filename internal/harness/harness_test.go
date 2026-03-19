package harness

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestLoadHarness_DefaultsOnly(t *testing.T) {
	dir := t.TempDir()
	defaults := &Harness{
		Tier0: []string{"go build ./..."},
		Tier1: []string{"go test ./..."},
	}
	h, err := LoadHarness(dir, "gt-abc", defaults)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.Tier0, defaults.Tier0) {
		t.Errorf("Tier0 = %v, want %v", h.Tier0, defaults.Tier0)
	}
	if !reflect.DeepEqual(h.Tier1, defaults.Tier1) {
		t.Errorf("Tier1 = %v, want %v", h.Tier1, defaults.Tier1)
	}
}

func TestLoadHarness_NilDefaults(t *testing.T) {
	dir := t.TempDir()
	h, err := LoadHarness(dir, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if h.Tier0 != nil || h.Tier1 != nil {
		t.Errorf("expected nil tiers, got Tier0=%v Tier1=%v", h.Tier0, h.Tier1)
	}
}

func TestLoadHarness_RepoOverridesDefaults(t *testing.T) {
	dir := t.TempDir()
	writeYAML(t, filepath.Join(dir, ".gastown"), "harness.yaml", "tier0:\n  - make build\n")

	defaults := &Harness{
		Tier0: []string{"go build ./..."},
		Tier1: []string{"go test ./..."},
	}
	h, err := LoadHarness(dir, "", defaults)
	if err != nil {
		t.Fatal(err)
	}
	want0 := []string{"make build"}
	if !reflect.DeepEqual(h.Tier0, want0) {
		t.Errorf("Tier0 = %v, want %v", h.Tier0, want0)
	}
	// Tier1 should fall through from defaults.
	if !reflect.DeepEqual(h.Tier1, defaults.Tier1) {
		t.Errorf("Tier1 = %v, want %v", h.Tier1, defaults.Tier1)
	}
}

func TestLoadHarness_BeadOverridesRepo(t *testing.T) {
	dir := t.TempDir()
	writeYAML(t, filepath.Join(dir, ".gastown"), "harness.yaml", "tier0:\n  - repo-build\ntier1:\n  - repo-test\n")
	writeYAML(t, filepath.Join(dir, ".gastown", "harness"), "gt-abc.yaml", "tier1:\n  - bead-test\n")

	h, err := LoadHarness(dir, "gt-abc", nil)
	if err != nil {
		t.Fatal(err)
	}
	// Tier0 from repo layer.
	if !reflect.DeepEqual(h.Tier0, []string{"repo-build"}) {
		t.Errorf("Tier0 = %v, want [repo-build]", h.Tier0)
	}
	// Tier1 overridden by bead layer.
	if !reflect.DeepEqual(h.Tier1, []string{"bead-test"}) {
		t.Errorf("Tier1 = %v, want [bead-test]", h.Tier1)
	}
}

func TestLoadHarness_FullStack(t *testing.T) {
	dir := t.TempDir()
	writeYAML(t, filepath.Join(dir, ".gastown"), "harness.yaml", "tier0:\n  - repo-build\n")
	writeYAML(t, filepath.Join(dir, ".gastown", "harness"), "gt-x1.yaml", "tier0:\n  - bead-build\n")

	defaults := &Harness{
		Tier0: []string{"default-build"},
		Tier1: []string{"default-test"},
	}
	h, err := LoadHarness(dir, "gt-x1", defaults)
	if err != nil {
		t.Fatal(err)
	}
	// Tier0: bead > repo > default → bead wins.
	if !reflect.DeepEqual(h.Tier0, []string{"bead-build"}) {
		t.Errorf("Tier0 = %v, want [bead-build]", h.Tier0)
	}
	// Tier1: no bead or repo override → default wins.
	if !reflect.DeepEqual(h.Tier1, defaults.Tier1) {
		t.Errorf("Tier1 = %v, want %v", h.Tier1, defaults.Tier1)
	}
}

func TestLoadHarness_EmptyBeadID(t *testing.T) {
	dir := t.TempDir()
	writeYAML(t, filepath.Join(dir, ".gastown"), "harness.yaml", "tier0:\n  - repo-cmd\n")

	h, err := LoadHarness(dir, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(h.Tier0, []string{"repo-cmd"}) {
		t.Errorf("Tier0 = %v, want [repo-cmd]", h.Tier0)
	}
}

func TestLoadHarness_BadYAML(t *testing.T) {
	dir := t.TempDir()
	writeYAML(t, filepath.Join(dir, ".gastown"), "harness.yaml", "{{bad yaml")

	_, err := LoadHarness(dir, "", nil)
	if err == nil {
		t.Fatal("expected error for bad YAML")
	}
}

func writeYAML(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}
