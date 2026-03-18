package doctor

import (
	"bytes"
	"testing"
)

// stubTriageCheck is a minimal TriageCheck for testing the runner.
type stubTriageCheck struct {
	BaseTriageCheck
	status  CheckStatus
	message string
	fixable bool
	fixErr  error
	fixRan  bool
}

func (s *stubTriageCheck) Run(ctx *CheckContext) *CheckResult {
	return &CheckResult{
		Name:    s.CheckName,
		Status:  s.status,
		Message: s.message,
	}
}

func (s *stubTriageCheck) CanFix() bool { return s.fixable }

func (s *stubTriageCheck) Fix(ctx *CheckContext) error {
	s.fixRan = true
	if s.fixErr != nil {
		return s.fixErr
	}
	s.status = StatusOK
	s.message = "all good"
	return nil
}

func TestTriageRunnerRun(t *testing.T) {
	tr := NewTriageRunner()
	tr.Register(&stubTriageCheck{
		BaseTriageCheck: NewBaseTriageCheck("triage-stub", "stub check"),
		status:          StatusOK,
		message:         "ok",
	})

	if len(tr.Checks()) != 1 {
		t.Fatalf("expected 1 check, got %d", len(tr.Checks()))
	}

	ctx := &CheckContext{TownRoot: "/tmp/fake"}
	report := NewReport()
	var buf bytes.Buffer
	tr.Run(ctx, report, &buf, 0)

	if report.Summary.Total != 1 {
		t.Fatalf("expected 1 total, got %d", report.Summary.Total)
	}
	if report.Summary.OK != 1 {
		t.Fatalf("expected 1 OK, got %d", report.Summary.OK)
	}
	if report.Checks[0].Category != CategoryTriage {
		t.Fatalf("expected category %q, got %q", CategoryTriage, report.Checks[0].Category)
	}
}

func TestTriageRunnerFix(t *testing.T) {
	check := &stubTriageCheck{
		BaseTriageCheck: NewBaseTriageCheck("triage-fixable", "fixable check"),
		status:          StatusError,
		message:         "broken",
		fixable:         true,
	}
	tr := NewTriageRunner()
	tr.Register(check)

	ctx := &CheckContext{TownRoot: "/tmp/fake"}
	report := NewReport()
	var buf bytes.Buffer
	tr.Fix(ctx, report, &buf, 0)

	if !check.fixRan {
		t.Fatal("expected Fix() to be called")
	}
	if report.Summary.Total != 1 {
		t.Fatalf("expected 1 total, got %d", report.Summary.Total)
	}
	if report.Summary.Fixed != 1 {
		t.Fatalf("expected 1 fixed, got %d", report.Summary.Fixed)
	}
}

func TestTriageRunnerEmpty(t *testing.T) {
	tr := NewTriageRunner()
	ctx := &CheckContext{TownRoot: "/tmp/fake"}
	report := NewReport()
	var buf bytes.Buffer
	tr.Run(ctx, report, &buf, 0)

	if report.Summary.Total != 0 {
		t.Fatalf("expected 0 total for empty runner, got %d", report.Summary.Total)
	}
	if buf.Len() != 0 {
		t.Fatalf("expected no output for empty runner, got %q", buf.String())
	}
}
