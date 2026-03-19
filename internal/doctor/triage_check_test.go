package doctor

import (
	"testing"
)

func TestNewOrphanedWispsTriageCheck(t *testing.T) {
	check := NewOrphanedWispsTriageCheck()
	if check.Name() != "triage-orphaned-wisps" {
		t.Errorf("Name() = %q, want %q", check.Name(), "triage-orphaned-wisps")
	}
	if check.Category() != CategoryCleanup {
		t.Errorf("Category() = %q, want %q", check.Category(), CategoryCleanup)
	}
	if !check.CanFix() {
		t.Error("CanFix() = false, want true")
	}
}

func TestNewStaleHooksTriageCheck(t *testing.T) {
	check := NewStaleHooksTriageCheck()
	if check.Name() != "triage-stale-hooks" {
		t.Errorf("Name() = %q, want %q", check.Name(), "triage-stale-hooks")
	}
	if check.Category() != CategoryHooks {
		t.Errorf("Category() = %q, want %q", check.Category(), CategoryHooks)
	}
	if check.CanFix() {
		t.Error("CanFix() = true, want false (stale hooks are risky to auto-close)")
	}
}

func TestAssigneeToSession(t *testing.T) {
	tests := []struct {
		assignee string
		want     string
	}{
		{"gastown/polecats/dag", "gt-dag"},
		{"gastown/witness", "gt-witness"},
		{"gastown/refinery", "gt-refinery"},
		{"gastown/crew/dom", "gt-crew-dom"},
		{"", ""},
		{"invalid", ""},
	}

	for _, tt := range tests {
		got := assigneeToSession(tt.assignee)
		if got != tt.want {
			t.Errorf("assigneeToSession(%q) = %q, want %q", tt.assignee, got, tt.want)
		}
	}
}

func TestOrphanedWispsTriageCheck_NoRigs(t *testing.T) {
	check := NewOrphanedWispsTriageCheck()
	ctx := &CheckContext{TownRoot: t.TempDir()}
	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("Status = %v, want OK (no rigs)", result.Status)
	}
}

func TestStaleHooksTriageCheck_NoRigs(t *testing.T) {
	check := NewStaleHooksTriageCheck()
	ctx := &CheckContext{TownRoot: t.TempDir()}
	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("Status = %v, want OK (no rigs)", result.Status)
	}
}
