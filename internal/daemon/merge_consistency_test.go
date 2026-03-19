package daemon

import (
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestPushUnpushedMerges_DetectsUnpushedCommits verifies that the daemon
// detects when a rig's working branch has commits that aren't on origin
// and pushes them.
func TestPushUnpushedMerges_DetectsUnpushedCommits(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix git operations")
	}
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	// 1. Create a "remote" repo with an initial commit on feature-x
	remoteDir := t.TempDir()
	gitRun(t, remoteDir, "git", "init", "--bare")

	seedDir := t.TempDir()
	gitRun(t, seedDir, "git", "init")
	gitRun(t, seedDir, "git", "checkout", "-b", "feature-x")
	os.WriteFile(filepath.Join(seedDir, "init.txt"), []byte("init"), 0644)
	gitRun(t, seedDir, "git", "add", ".")
	gitRun(t, seedDir, "git", "commit", "-m", "initial")
	gitRun(t, seedDir, "git", "remote", "add", "origin", remoteDir)
	gitRun(t, seedDir, "git", "push", "origin", "feature-x")

	// 2. Create town structure with rig
	townRoot := t.TempDir()
	rigDir := filepath.Join(townRoot, "myr")
	os.MkdirAll(rigDir, 0755)

	configJSON := `{"type":"rig","version":1,"name":"myr","default_branch":"main","base_branch":"feature-x"}`
	os.WriteFile(filepath.Join(rigDir, "config.json"), []byte(configJSON), 0644)

	// 3. Clone remote as bare repo into .repo.git
	repoGit := filepath.Join(rigDir, ".repo.git")
	gitRun(t, townRoot, "git", "clone", "--bare", remoteDir, repoGit)

	// 4. Simulate refinery merging locally but not pushing:
	//    Add a commit to the local feature-x that isn't on origin
	tmpWork := t.TempDir()
	gitRun(t, tmpWork, "git", "clone", repoGit, ".")
	gitRun(t, tmpWork, "git", "checkout", "feature-x")
	os.WriteFile(filepath.Join(tmpWork, "merged.txt"), []byte("merged work"), 0644)
	gitRun(t, tmpWork, "git", "add", ".")
	gitRun(t, tmpWork, "git", "commit", "-m", "squash merge from polecat")
	// Push to the bare repo only (not to the real remote)
	gitRun(t, tmpWork, "git", "push", repoGit, "feature-x")

	// 6. Write rigs.json
	mayorDir := filepath.Join(townRoot, "mayor")
	os.MkdirAll(mayorDir, 0755)
	rigsJSON := `{"version":1,"rigs":{"myr":{"git_url":"` + remoteDir + `"}}}`
	os.WriteFile(filepath.Join(mayorDir, "rigs.json"), []byte(rigsJSON), 0644)

	// 7. Run the check
	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: townRoot},
		logger: log.New(&logBuf, "", 0),
	}

	d.pushUnpushedMerges()

	got := logBuf.String()
	if !strings.Contains(got, "MERGE_CONSISTENCY") {
		t.Errorf("expected MERGE_CONSISTENCY log, got: %q", got)
	}
	if !strings.Contains(got, "unpushed commit") {
		t.Errorf("expected 'unpushed commit' in log, got: %q", got)
	}

	// 8. Verify the commit made it to the remote
	verifyOutput, _ := exec.Command("git", "--git-dir", remoteDir, "log", "feature-x", "--oneline").Output()
	if !strings.Contains(string(verifyOutput), "squash merge from polecat") {
		t.Errorf("expected 'squash merge from polecat' on remote, got: %q", string(verifyOutput))
	}
}

// TestPushUnpushedMerges_NothingToPush verifies the daemon doesn't act
// when the working branch is up to date with origin.
func TestPushUnpushedMerges_NothingToPush(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix git operations")
	}
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not available")
	}

	// Create remote with initial commit on main
	remoteDir := t.TempDir()
	gitRun(t, remoteDir, "git", "init", "--bare")

	seedDir := t.TempDir()
	gitRun(t, seedDir, "git", "init")
	os.WriteFile(filepath.Join(seedDir, "init.txt"), []byte("init"), 0644)
	gitRun(t, seedDir, "git", "add", ".")
	gitRun(t, seedDir, "git", "commit", "-m", "initial")
	gitRun(t, seedDir, "git", "remote", "add", "origin", remoteDir)
	gitRun(t, seedDir, "git", "push", "origin", "HEAD:main")

	// Create town + rig
	townRoot := t.TempDir()
	rigDir := filepath.Join(townRoot, "myr")
	os.MkdirAll(rigDir, 0755)
	os.WriteFile(filepath.Join(rigDir, "config.json"), []byte(`{"type":"rig","version":1,"name":"myr","default_branch":"main"}`), 0644)

	repoGit := filepath.Join(rigDir, ".repo.git")
	gitRun(t, townRoot, "git", "clone", "--bare", remoteDir, repoGit)

	mayorDir := filepath.Join(townRoot, "mayor")
	os.MkdirAll(mayorDir, 0755)
	os.WriteFile(filepath.Join(mayorDir, "rigs.json"), []byte(`{"version":1,"rigs":{"myr":{"git_url":"`+remoteDir+`"}}}`), 0644)

	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: townRoot},
		logger: log.New(&logBuf, "", 0),
	}

	d.pushUnpushedMerges()

	got := logBuf.String()
	if strings.Contains(got, "MERGE_CONSISTENCY") {
		t.Errorf("expected no MERGE_CONSISTENCY log when up to date, got: %q", got)
	}
}

func gitRun(t *testing.T, dir string, name string, args ...string) {
	t.Helper()
	cmd := exec.Command(name, args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(),
		"GIT_AUTHOR_NAME=test", "GIT_AUTHOR_EMAIL=test@test.com",
		"GIT_COMMITTER_NAME=test", "GIT_COMMITTER_EMAIL=test@test.com",
	)
	if output, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("%s %v in %s failed: %s: %v", name, args, dir, string(output), err)
	}
}
