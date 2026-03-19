package harness

import (
	"context"
	"os"
	"testing"
)

func TestRunHarness_AllPass(t *testing.T) {
	dir := t.TempDir()
	res := RunHarness(context.Background(), dir, []string{
		"echo hello",
		"echo world",
	})
	if !res.Success {
		t.Fatalf("expected success, got failure at %d", res.FailedAt)
	}
	if len(res.Results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(res.Results))
	}
	if res.FailedAt != -1 {
		t.Fatalf("expected FailedAt=-1, got %d", res.FailedAt)
	}
	if got := res.Results[0].Stdout; got != "hello\n" {
		t.Errorf("stdout[0] = %q, want %q", got, "hello\n")
	}
}

func TestRunHarness_StopsOnFirstFailure(t *testing.T) {
	dir := t.TempDir()
	res := RunHarness(context.Background(), dir, []string{
		"echo ok",
		"exit 42",
		"echo should-not-run",
	})
	if res.Success {
		t.Fatal("expected failure")
	}
	if res.FailedAt != 1 {
		t.Fatalf("expected FailedAt=1, got %d", res.FailedAt)
	}
	if len(res.Results) != 2 {
		t.Fatalf("expected 2 results (stopped before 3rd), got %d", len(res.Results))
	}
	if res.Results[1].ExitCode != 42 {
		t.Errorf("exit code = %d, want 42", res.Results[1].ExitCode)
	}
}

func TestRunHarness_EmptyCommands(t *testing.T) {
	dir := t.TempDir()
	res := RunHarness(context.Background(), dir, nil)
	if !res.Success {
		t.Fatal("empty command list should succeed")
	}
	if len(res.Results) != 0 {
		t.Fatalf("expected 0 results, got %d", len(res.Results))
	}
}

func TestRunHarness_WorkdirRespected(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(dir+"/marker.txt", []byte("found"), 0644); err != nil {
		t.Fatal(err)
	}
	res := RunHarness(context.Background(), dir, []string{"cat marker.txt"})
	if !res.Success {
		t.Fatalf("expected success: %s", res.Results[0].Stderr)
	}
	if got := res.Results[0].Stdout; got != "found" {
		t.Errorf("stdout = %q, want %q", got, "found")
	}
}

func TestRunHarness_CapturesStderr(t *testing.T) {
	dir := t.TempDir()
	res := RunHarness(context.Background(), dir, []string{"echo err >&2"})
	if !res.Success {
		t.Fatal("expected success")
	}
	if got := res.Results[0].Stderr; got != "err\n" {
		t.Errorf("stderr = %q, want %q", got, "err\n")
	}
}

func TestRunHarness_ContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately
	dir := t.TempDir()
	res := RunHarness(ctx, dir, []string{"sleep 10"})
	if res.Success {
		t.Fatal("expected failure on canceled context")
	}
}

func TestRunTiered_Tier0FailSkipsTier1(t *testing.T) {
	dir := t.TempDir()
	tiers := [][]string{
		{"echo tier0-a", "exit 1"},       // tier 0: second cmd fails
		{"echo tier1-should-not-run"},     // tier 1: should be skipped
	}
	res := RunTiered(context.Background(), dir, tiers)
	if res.Success {
		t.Fatal("expected failure")
	}
	if len(res.Results) != 2 {
		t.Fatalf("expected 2 results (tier0-a + failing cmd), got %d", len(res.Results))
	}
	if res.FailedAt != 1 {
		t.Fatalf("expected FailedAt=1, got %d", res.FailedAt)
	}
	// Verify tier1 command never ran
	for _, cr := range res.Results {
		if cr.Command == "echo tier1-should-not-run" {
			t.Error("tier1 command should not have been executed")
		}
	}
}

func TestRunTiered_AllTiersPass(t *testing.T) {
	dir := t.TempDir()
	tiers := [][]string{
		{"echo tier0"},
		{"echo tier1-a", "echo tier1-b"},
	}
	res := RunTiered(context.Background(), dir, tiers)
	if !res.Success {
		t.Fatalf("expected success, failed at %d", res.FailedAt)
	}
	if len(res.Results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(res.Results))
	}
}

func TestRunHarness_EmptyCommand(t *testing.T) {
	dir := t.TempDir()
	res := RunHarness(context.Background(), dir, []string{"  "})
	if res.Success {
		t.Fatal("empty command should fail")
	}
	if res.Results[0].ExitCode != 1 {
		t.Errorf("exit code = %d, want 1", res.Results[0].ExitCode)
	}
}

func TestResult_Summary(t *testing.T) {
	pass := Result{Success: true, Results: make([]CommandResult, 3), FailedAt: -1}
	if got := pass.Summary(); got != "all 3 commands passed" {
		t.Errorf("pass summary = %q", got)
	}

	fail := Result{
		Results:  []CommandResult{{Command: "make test", ExitCode: 2}},
		FailedAt: 0,
	}
	if got := fail.Summary(); got != "failed at command 0: make test (exit 2)" {
		t.Errorf("fail summary = %q", got)
	}
}
