package doctor

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// RefFreshnessCheck verifies that configured branches (default_branch, base_branch)
// exist in the bare repo and that local refs are not stale compared to origin.
// This is a triage-level check: it catches misconfigurations and drift that cause
// polecat spawns and merges to fail silently.
type RefFreshnessCheck struct {
	FixableCheck
	staleRigs []staleRigInfo // cached for Fix
}

type staleRigInfo struct {
	rigName  string
	bareRepo string
}

// NewRefFreshnessCheck creates a new ref freshness check.
func NewRefFreshnessCheck() *RefFreshnessCheck {
	return &RefFreshnessCheck{
		FixableCheck: FixableCheck{
			BaseCheck: BaseCheck{
				CheckName:        "ref-freshness",
				CheckDescription: "Verify configured branches exist and refs are fresh",
				CheckCategory:    CategoryRig,
			},
		},
	}
}

// rigBranchConfig holds the branch configuration for a rig.
type rigBranchConfig struct {
	DefaultBranch string `json:"default_branch"`
	BaseBranch    string `json:"base_branch"`
}

// Run checks branch existence and ref freshness for all rigs.
func (c *RefFreshnessCheck) Run(ctx *CheckContext) *CheckResult {
	entries, err := os.ReadDir(ctx.TownRoot)
	if err != nil {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusError,
			Message: fmt.Sprintf("Cannot read town root: %v", err),
		}
	}

	c.staleRigs = nil
	var problems []string
	rigsChecked := 0

	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") ||
			entry.Name() == "mayor" || entry.Name() == "docs" || entry.Name() == "scripts" {
			continue
		}

		rigPath := filepath.Join(ctx.TownRoot, entry.Name())
		configPath := filepath.Join(rigPath, "config.json")

		data, err := os.ReadFile(configPath)
		if err != nil {
			continue // not a rig
		}

		var cfg rigBranchConfig
		if err := json.Unmarshal(data, &cfg); err != nil {
			continue
		}

		bareRepo := filepath.Join(rigPath, ".repo.git")
		if _, err := os.Stat(bareRepo); os.IsNotExist(err) {
			continue // no bare repo
		}

		rigsChecked++
		rigProblems := c.checkRig(entry.Name(), bareRepo, cfg)
		if len(rigProblems) > 0 {
			problems = append(problems, rigProblems...)
			c.staleRigs = append(c.staleRigs, staleRigInfo{
				rigName:  entry.Name(),
				bareRepo: bareRepo,
			})
		}
	}

	if len(problems) > 0 {
		status := StatusWarning
		for _, p := range problems {
			if strings.Contains(p, "not found") {
				status = StatusError
				break
			}
		}
		return &CheckResult{
			Name:    c.Name(),
			Status:  status,
			Message: fmt.Sprintf("%d issue(s) across %d rig(s)", len(problems), len(c.staleRigs)),
			Details: problems,
			FixHint: "Run 'gt doctor --fix' to fetch latest refs from origin",
		}
	}

	if rigsChecked == 0 {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusOK,
			Message: "No rigs with bare repos found",
		}
	}

	return &CheckResult{
		Name:    c.Name(),
		Status:  StatusOK,
		Message: fmt.Sprintf("All %d rig(s) have valid, fresh refs", rigsChecked),
	}
}

// checkRig verifies branch existence and ref freshness for a single rig.
func (c *RefFreshnessCheck) checkRig(rigName, bareRepo string, cfg rigBranchConfig) []string {
	var problems []string

	// Determine which branches to check
	branches := map[string]string{} // label -> branch name
	defaultBranch := cfg.DefaultBranch
	if defaultBranch == "" {
		defaultBranch = "main"
	}
	branches["default_branch"] = defaultBranch

	if cfg.BaseBranch != "" && cfg.BaseBranch != defaultBranch {
		branches["base_branch"] = cfg.BaseBranch
	}

	for label, branch := range branches {
		// Check both remote tracking ref and local branch in bare repo
		remoteRef := fmt.Sprintf("refs/remotes/origin/%s", branch)
		localRef := fmt.Sprintf("refs/heads/%s", branch)
		if !c.refExists(bareRepo, remoteRef) && !c.refExists(bareRepo, localRef) {
			problems = append(problems, fmt.Sprintf("%s: %s %q not found in bare repo", rigName, label, branch))
			continue
		}

		// Check freshness: compare local tracking ref with remote
		behind, err := c.commitsBehindRemote(bareRepo, branch)
		if err != nil {
			// Can't determine freshness (network issue, etc.) — not an error
			continue
		}
		if behind > 50 {
			problems = append(problems, fmt.Sprintf("%s: origin/%s is %d commits behind remote (STALE)", rigName, branch, behind))
		} else if behind > 10 {
			problems = append(problems, fmt.Sprintf("%s: origin/%s is %d commits behind remote", rigName, branch, behind))
		}
	}

	return problems
}

// refExists checks if a ref exists in the bare repo.
func (c *RefFreshnessCheck) refExists(bareRepo, ref string) bool {
	cmd := exec.Command("git", "-C", bareRepo, "rev-parse", "--verify", ref)
	return cmd.Run() == nil
}

// commitsBehindRemote uses ls-remote to get the current remote HEAD for a branch,
// then compares with the local tracking ref. Returns how many commits the local
// ref is behind, or an error if the comparison can't be made.
func (c *RefFreshnessCheck) commitsBehindRemote(bareRepo, branch string) (int, error) {
	// Get remote SHA via ls-remote (network call)
	cmd := exec.Command("git", "-C", bareRepo, "ls-remote", "--exit-code", "origin", "refs/heads/"+branch)
	out, err := cmd.Output()
	if err != nil {
		return 0, fmt.Errorf("ls-remote failed: %w", err)
	}

	fields := strings.Fields(strings.TrimSpace(string(out)))
	if len(fields) < 1 {
		return 0, fmt.Errorf("unexpected ls-remote output")
	}
	remoteSHA := fields[0]

	// Get local tracking ref SHA (try remote tracking first, then local branch)
	var localSHA string
	for _, ref := range []string{
		fmt.Sprintf("refs/remotes/origin/%s", branch),
		fmt.Sprintf("refs/heads/%s", branch),
	} {
		cmd = exec.Command("git", "-C", bareRepo, "rev-parse", "--verify", ref)
		localOut, err := cmd.Output()
		if err == nil {
			localSHA = strings.TrimSpace(string(localOut))
			break
		}
	}
	if localSHA == "" {
		return 0, fmt.Errorf("no local ref found for %s", branch)
	}

	if localSHA == remoteSHA {
		return 0, nil
	}

	// Check if remote SHA exists locally (we may not have fetched it yet)
	cmd = exec.Command("git", "-C", bareRepo, "cat-file", "-t", remoteSHA)
	if err := cmd.Run(); err != nil {
		// Remote SHA not in local repo — stale but can't count exactly
		return 1, nil
	}

	// Both SHAs exist locally — count the difference
	cmd = exec.Command("git", "-C", bareRepo, "rev-list", "--count", localSHA+".."+remoteSHA)
	countOut, err := cmd.Output()
	if err != nil {
		return 1, nil
	}

	var count int
	_, _ = fmt.Sscanf(strings.TrimSpace(string(countOut)), "%d", &count)
	return count, nil
}

// Fix fetches latest refs from origin for all rigs with issues.
func (c *RefFreshnessCheck) Fix(ctx *CheckContext) error {
	if len(c.staleRigs) == 0 {
		return nil
	}

	var lastErr error
	for _, rig := range c.staleRigs {
		cmd := exec.Command("git", "-C", rig.bareRepo, "fetch", "origin", "--prune")
		if out, err := cmd.CombinedOutput(); err != nil {
			lastErr = fmt.Errorf("%s: fetch failed: %s", rig.rigName, strings.TrimSpace(string(out)))
		}
	}
	return lastErr
}
