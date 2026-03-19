package harness

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadHarness_Go(t *testing.T) {
	dir := t.TempDir()
	touchFile(t, dir, "go.mod")

	h := LoadHarness(dir)
	if h.Empty() {
		t.Fatal("expected non-empty harness for Go project")
	}
	wantTier0 := []string{"go build ./..."}
	wantTier1 := []string{"go test ./...", "golangci-lint run"}
	assertSlice(t, "Tier0", h.Tier0, wantTier0)
	assertSlice(t, "Tier1", h.Tier1, wantTier1)
}

func TestLoadHarness_Node(t *testing.T) {
	dir := t.TempDir()
	touchFile(t, dir, "package.json")

	h := LoadHarness(dir)
	if len(h.Tier0) != 2 {
		t.Fatalf("Tier0 len = %d, want 2 (build + typecheck)", len(h.Tier0))
	}
	if h.Tier0[1] != "tsc --noEmit" {
		t.Errorf("Tier0[1] = %q, want typecheck", h.Tier0[1])
	}
}

func TestLoadHarness_Empty(t *testing.T) {
	dir := t.TempDir()
	h := LoadHarness(dir)
	if !h.Empty() {
		t.Errorf("expected empty harness for unknown project, got %+v", h)
	}
}

func TestHarness_Tiers(t *testing.T) {
	h := Harness{
		Tier0: []string{"go build ./..."},
		Tier1: []string{"go test ./..."},
	}
	tiers := h.Tiers()
	if len(tiers) != 2 {
		t.Fatalf("len(Tiers()) = %d, want 2", len(tiers))
	}
}

func TestHarness_Tiers_EmptyTier(t *testing.T) {
	h := Harness{Tier0: []string{"go build ./..."}}
	tiers := h.Tiers()
	if len(tiers) != 1 {
		t.Fatalf("len(Tiers()) = %d, want 1 (empty tier1 omitted)", len(tiers))
	}
}

func touchFile(t *testing.T, dir, name string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), nil, 0644); err != nil {
		t.Fatal(err)
	}
}

func assertSlice(t *testing.T, label string, got, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("%s: len = %d, want %d: %v", label, len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s[%d] = %q, want %q", label, i, got[i], want[i])
		}
	}
}
