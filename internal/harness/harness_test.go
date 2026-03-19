package harness

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadHarness_NoConfig(t *testing.T) {
	dir := t.TempDir()
	h := LoadHarness(dir, dir, "gt-abc")
	if h != nil {
		t.Fatal("expected nil harness when no config exists")
	}
}

func TestLoadHarness_RepoLevel(t *testing.T) {
	dir := t.TempDir()
	gsDir := filepath.Join(dir, ".gastown")
	os.MkdirAll(gsDir, 0o755)
	os.WriteFile(filepath.Join(gsDir, "harness.yaml"), []byte("tier0:\n  - go build ./...\ntier1:\n  - go vet ./...\n"), 0o644)

	h := LoadHarness(dir, dir, "")
	if h == nil {
		t.Fatal("expected non-nil harness")
	}
	if len(h.Tier0) != 1 || h.Tier0[0] != "go build ./..." {
		t.Errorf("tier0 = %v, want [go build ./...]", h.Tier0)
	}
	if len(h.Tier1) != 1 || h.Tier1[0] != "go vet ./..." {
		t.Errorf("tier1 = %v, want [go vet ./...]", h.Tier1)
	}
}

func TestLoadHarness_BeadOverridesRepo(t *testing.T) {
	dir := t.TempDir()
	gsDir := filepath.Join(dir, ".gastown")
	os.MkdirAll(filepath.Join(gsDir, "harness"), 0o755)

	// Repo-level
	os.WriteFile(filepath.Join(gsDir, "harness.yaml"), []byte("tier0:\n  - make build\ntier1:\n  - make lint\n"), 0o644)
	// Bead-specific override
	os.WriteFile(filepath.Join(gsDir, "harness", "gt-xyz.yaml"), []byte("tier0:\n  - go build ./...\n"), 0o644)

	h := LoadHarness(dir, dir, "gt-xyz")
	if h == nil {
		t.Fatal("expected non-nil harness")
	}
	// Tier0 should be overridden by bead-specific
	if len(h.Tier0) != 1 || h.Tier0[0] != "go build ./..." {
		t.Errorf("tier0 = %v, want [go build ./...]", h.Tier0)
	}
	// Tier1 should fall through from repo-level
	if len(h.Tier1) != 1 || h.Tier1[0] != "make lint" {
		t.Errorf("tier1 = %v, want [make lint]", h.Tier1)
	}
}

func TestRunHarness_AllPass(t *testing.T) {
	orig := CommandRunner
	defer func() { CommandRunner = orig }()

	CommandRunner = func(workdir, command string) Result {
		return Result{Command: command, ExitCode: 0}
	}

	h := &Harness{Tier0: []string{"build"}, Tier1: []string{"lint"}}
	report := RunHarness(t.TempDir(), h)
	if !report.Passed {
		t.Fatal("expected harness to pass")
	}
	if len(report.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(report.Results))
	}
}

func TestRunHarness_Tier0FailSkipsTier1(t *testing.T) {
	orig := CommandRunner
	defer func() { CommandRunner = orig }()

	CommandRunner = func(workdir, command string) Result {
		if command == "build" {
			return Result{Command: command, ExitCode: 1, Stderr: "compile error"}
		}
		return Result{Command: command, ExitCode: 0}
	}

	h := &Harness{Tier0: []string{"build"}, Tier1: []string{"lint"}}
	report := RunHarness(t.TempDir(), h)
	if report.Passed {
		t.Fatal("expected harness to fail")
	}
	// Only tier0 should have run
	if len(report.Results) != 1 {
		t.Fatalf("expected 1 result (tier1 skipped), got %d", len(report.Results))
	}
	if report.Results[0].Tier != "tier0" {
		t.Errorf("expected tier0, got %s", report.Results[0].Tier)
	}
}

func TestRunHarness_Tier1Fail(t *testing.T) {
	orig := CommandRunner
	defer func() { CommandRunner = orig }()

	CommandRunner = func(workdir, command string) Result {
		if command == "lint" {
			return Result{Command: command, ExitCode: 1, Stderr: "lint error"}
		}
		return Result{Command: command, ExitCode: 0}
	}

	h := &Harness{Tier0: []string{"build"}, Tier1: []string{"lint"}}
	report := RunHarness(t.TempDir(), h)
	if report.Passed {
		t.Fatal("expected harness to fail on tier1")
	}
	if len(report.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(report.Results))
	}
}

func TestRunHarness_EmptyHarness(t *testing.T) {
	h := &Harness{}
	report := RunHarness(t.TempDir(), h)
	if !report.Passed {
		t.Fatal("empty harness should pass")
	}
	if len(report.Results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(report.Results))
	}
}

func TestFormatReport_IncludesStderr(t *testing.T) {
	report := &RunReport{
		Passed: false,
		Results: []Result{
			{Command: "build", Tier: "tier0", ExitCode: 1, Stderr: "error: missing semicolon"},
		},
	}
	out := FormatReport(report)
	if !contains(out, "✗") {
		t.Error("expected failure marker in output")
	}
	if !contains(out, "missing semicolon") {
		t.Error("expected stderr in output")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(s) > 0 && containsHelper(s, substr))
}

func containsHelper(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
