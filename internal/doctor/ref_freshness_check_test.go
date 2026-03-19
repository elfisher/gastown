package doctor

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestRefFreshnessCheck_Name(t *testing.T) {
	check := NewRefFreshnessCheck()
	if check.Name() != "ref-freshness" {
		t.Errorf("expected name 'ref-freshness', got %q", check.Name())
	}
	if !check.CanFix() {
		t.Error("expected CanFix to return true")
	}
}

func TestRefFreshnessCheck_NoRigs(t *testing.T) {
	tmpDir := t.TempDir()
	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK with no rigs, got %v: %s", result.Status, result.Message)
	}
}

// setupBareRepoWithOrigin creates an upstream repo and a bare repo (.repo.git)
// that has origin pointing to the upstream, with refs/remotes/origin/main fetched.
func setupBareRepoWithOrigin(t *testing.T, rigDir string) (bareRepo, upstream string) {
	t.Helper()

	// Create upstream repo
	upstream = filepath.Join(t.TempDir(), "upstream")
	runGit(t, "", "init", "-b", "main", upstream)
	runGit(t, upstream, "commit", "--allow-empty", "-m", "initial")

	// Clone as bare repo
	bareRepo = filepath.Join(rigDir, ".repo.git")
	runGit(t, "", "clone", "--bare", upstream, bareRepo)

	// Configure fetch refspec so `git fetch origin` creates refs/remotes/origin/*
	// (bare clones don't have this by default)
	runGit(t, bareRepo, "config", "remote.origin.fetch", "+refs/heads/*:refs/remotes/origin/*")

	// Fetch to populate refs/remotes/origin/main
	runGit(t, bareRepo, "fetch", "origin")

	return bareRepo, upstream
}

func TestRefFreshnessCheck_DefaultBranchExists(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	setupBareRepoWithOrigin(t, rigDir)
	writeRigConfig(t, rigDir, `{"default_branch": "main"}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK when default_branch exists, got %v: %s (details: %v)", result.Status, result.Message, result.Details)
	}
}

func TestRefFreshnessCheck_DefaultBranchMissing(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	setupBareRepoWithOrigin(t, rigDir)

	// Config references a branch that doesn't exist on origin
	writeRigConfig(t, rigDir, `{"default_branch": "develop"}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusError {
		t.Errorf("expected StatusError when default_branch missing, got %v: %s", result.Status, result.Message)
	}
	found := false
	for _, d := range result.Details {
		if strings.Contains(d, "develop") && strings.Contains(d, "not found") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected detail about missing 'develop' branch, got %v", result.Details)
	}
}

func TestRefFreshnessCheck_BaseBranchMissing(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	setupBareRepoWithOrigin(t, rigDir)

	// Config has base_branch that doesn't exist
	writeRigConfig(t, rigDir, `{"default_branch": "main", "base_branch": "release/v2"}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusError {
		t.Errorf("expected StatusError when base_branch missing, got %v: %s", result.Status, result.Message)
	}
	found := false
	for _, d := range result.Details {
		if strings.Contains(d, "release/v2") && strings.Contains(d, "not found") {
			found = true
		}
	}
	if !found {
		t.Errorf("expected detail about missing 'release/v2' branch, got %v", result.Details)
	}
}

func TestRefFreshnessCheck_BaseBranchSameAsDefault(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	setupBareRepoWithOrigin(t, rigDir)

	// base_branch == default_branch should not be checked twice
	writeRigConfig(t, rigDir, `{"default_branch": "main", "base_branch": "main"}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK when base_branch == default_branch, got %v: %s", result.Status, result.Message)
	}
}

func TestRefFreshnessCheck_EmptyDefaultBranchFallsBackToMain(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	setupBareRepoWithOrigin(t, rigDir)

	// No default_branch set — should fall back to "main"
	writeRigConfig(t, rigDir, `{}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK with empty default_branch (falls back to main), got %v: %s (details: %v)", result.Status, result.Message, result.Details)
	}
}

func TestRefFreshnessCheck_Fix(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	bareRepo, upstream := setupBareRepoWithOrigin(t, rigDir)
	writeRigConfig(t, rigDir, `{"default_branch": "main"}`)

	// Add a commit to upstream that the bare repo doesn't have yet
	runGit(t, upstream, "commit", "--allow-empty", "-m", "new commit")

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	// Run first to populate staleRigs (may or may not detect staleness
	// depending on whether ls-remote succeeds in test env)
	_ = check.Run(ctx)

	// Force staleRigs to include this rig for fix testing
	check.staleRigs = []staleRigInfo{{rigName: rigName, bareRepo: bareRepo}}

	// Fix should fetch
	err := check.Fix(ctx)
	if err != nil {
		t.Fatalf("Fix failed: %v", err)
	}

	// After fix, the bare repo should have the new commit
	cmd := exec.Command("git", "-C", bareRepo, "rev-parse", "refs/remotes/origin/main")
	localOut, err := cmd.Output()
	if err != nil {
		t.Fatalf("rev-parse failed: %v", err)
	}

	cmd = exec.Command("git", "-C", upstream, "rev-parse", "HEAD")
	upstreamOut, err := cmd.Output()
	if err != nil {
		t.Fatalf("rev-parse upstream failed: %v", err)
	}

	if strings.TrimSpace(string(localOut)) != strings.TrimSpace(string(upstreamOut)) {
		t.Error("expected bare repo to be in sync with upstream after fix")
	}
}

func TestRefFreshnessCheck_SkipsNonRigDirs(t *testing.T) {
	tmpDir := t.TempDir()

	// Create directories that should be skipped
	for _, name := range []string{".beads", "mayor", "docs", ".git"} {
		os.MkdirAll(filepath.Join(tmpDir, name), 0755)
	}

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK with only non-rig dirs, got %v", result.Status)
	}
}

func TestRefFreshnessCheck_NoBareRepo(t *testing.T) {
	tmpDir := t.TempDir()
	rigName := "testrig"
	rigDir := filepath.Join(tmpDir, rigName)

	// Config exists but no .repo.git
	writeRigConfig(t, rigDir, `{"default_branch": "main"}`)

	check := NewRefFreshnessCheck()
	ctx := &CheckContext{TownRoot: tmpDir}

	result := check.Run(ctx)
	if result.Status != StatusOK {
		t.Errorf("expected StatusOK when no bare repo exists, got %v: %s", result.Status, result.Message)
	}
}

// writeRigConfig writes a config.json file for a rig.
func writeRigConfig(t *testing.T, rigDir, content string) {
	t.Helper()
	if err := os.MkdirAll(rigDir, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(rigDir, "config.json"), []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}
