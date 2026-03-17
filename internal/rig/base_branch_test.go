package rig

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestRig_DefaultBranch_NoBaseBranch is a NEGATIVE test proving that
// Rig has no concept of a working/base branch separate from default_branch.
// Everything defaults to default_branch (typically "main").
//
// EXPECTED AFTER FIX: Rig.WorkingBranch() returns base_branch when set,
// falling back to DefaultBranch() when not set.
func TestRig_DefaultBranch_NoBaseBranch(t *testing.T) {
	// Create a rig config with default_branch but no base_branch
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

	// Current: DefaultBranch is the only option
	got := r.DefaultBranch()
	if got != "main" {
		t.Errorf("DefaultBranch() = %q, want %q", got, "main")
	}

	// NEGATIVE: WorkingBranch() doesn't exist yet.
	// After fix:
	// got = r.WorkingBranch()
	// if got != "main" {
	//     t.Errorf("WorkingBranch() should fall back to DefaultBranch when base_branch not set, got %q", got)
	// }
}

// TestRig_BaseBranch_NotSupported is a NEGATIVE test proving that
// RigConfig has no base_branch field. Setting it in JSON is silently ignored.
//
// EXPECTED AFTER FIX: RigConfig.BaseBranch is parsed from JSON and
// Rig.WorkingBranch() returns it.
func TestRig_BaseBranch_NotSupported(t *testing.T) {
	rigDir := t.TempDir()
	// Write config with a base_branch field (not in the struct yet)
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

	// NEGATIVE: DefaultBranch still returns "main" — base_branch is ignored
	got := r.DefaultBranch()
	if got != "main" {
		t.Errorf("DefaultBranch() = %q, want %q", got, "main")
	}

	// After fix:
	// got = r.WorkingBranch()
	// if got != "dashboard-v2" {
	//     t.Errorf("WorkingBranch() = %q, want %q", got, "dashboard-v2")
	// }
}
