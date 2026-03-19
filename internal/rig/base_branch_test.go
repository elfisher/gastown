package rig

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestRig_WorkingBranch_FallsBackToDefault verifies that WorkingBranch()
// returns DefaultBranch when base_branch is not set.
func TestRig_WorkingBranch_FallsBackToDefault(t *testing.T) {
	rigDir := t.TempDir()
	cfg := RigConfig{
		Type:          "rig",
		Version:       1,
		Name:          "test-rig",
		DefaultBranch: "main",
	}
	data, _ := json.Marshal(cfg)
	if err := os.WriteFile(filepath.Join(rigDir, "config.json"), data, 0644); err != nil {
		t.Fatal(err)
	}

	r := &Rig{Name: "test-rig", Path: rigDir}

	if got := r.WorkingBranch(); got != "main" {
		t.Errorf("WorkingBranch() = %q, want %q (should fall back to DefaultBranch)", got, "main")
	}
}

// TestRig_WorkingBranch_RespectsBaseBranch verifies that WorkingBranch()
// returns base_branch when set in the rig config.
func TestRig_WorkingBranch_RespectsBaseBranch(t *testing.T) {
	rigDir := t.TempDir()
	configJSON := `{
		"type": "rig",
		"version": 1,
		"name": "test-rig",
		"default_branch": "main",
		"base_branch": "dashboard-v2"
	}`
	if err := os.WriteFile(filepath.Join(rigDir, "config.json"), []byte(configJSON), 0644); err != nil {
		t.Fatal(err)
	}

	r := &Rig{Name: "test-rig", Path: rigDir}

	if got := r.WorkingBranch(); got != "dashboard-v2" {
		t.Errorf("WorkingBranch() = %q, want %q", got, "dashboard-v2")
	}
	// DefaultBranch should still return main
	if got := r.DefaultBranch(); got != "main" {
		t.Errorf("DefaultBranch() = %q, want %q (should be unchanged)", got, "main")
	}
}
