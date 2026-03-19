// Package harness implements verification contracts for gt done.
//
// A harness is a set of tiered commands (tier0, tier1) that must pass before
// work can be submitted to the merge queue. Commands are loaded from a layered
// config: bead-specific → repo-level → rig defaults.
package harness

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Harness holds the merged verification commands for a submission.
type Harness struct {
	Tier0 []string `yaml:"tier0"` // must-pass (build, typecheck)
	Tier1 []string `yaml:"tier1"` // should-pass (lint, targeted tests)
}

// Result captures the outcome of running a single command.
type Result struct {
	Command  string
	Tier     string
	ExitCode int
	Stdout   string
	Stderr   string
	Duration time.Duration
}

// RunReport is the aggregate result of running a full harness.
type RunReport struct {
	Results []Result
	Passed  bool
}

// harnessFile is the on-disk YAML shape.
type harnessFile struct {
	Tier0 []string `yaml:"tier0"`
	Tier1 []string `yaml:"tier1"`
}

// LoadHarness reads the layered harness config and returns merged commands.
// Priority (highest wins): bead-specific → repo .gastown/harness.yaml → rig defaults.
// Returns nil if no harness is configured at any layer.
func LoadHarness(rigPath, repoRoot, beadID string) *Harness {
	var h Harness

	// Layer 1: rig defaults (lowest priority) — from rig config JSON.
	// The rig config harness_defaults field is handled by the caller or
	// a future RigConfig.HarnessDefaults field (gt-qi4). For now we skip
	// this layer since the struct doesn't exist on main yet.

	// Layer 2: repo-level .gastown/harness.yaml
	repoFile := filepath.Join(repoRoot, ".gastown", "harness.yaml")
	if merged := loadYAML(repoFile); merged != nil {
		h.Tier0 = merged.Tier0
		h.Tier1 = merged.Tier1
	}

	// Layer 3: bead-specific .gastown/harness/<bead-id>.yaml (highest priority)
	if beadID != "" {
		beadFile := filepath.Join(repoRoot, ".gastown", "harness", beadID+".yaml")
		if specific := loadYAML(beadFile); specific != nil {
			if len(specific.Tier0) > 0 {
				h.Tier0 = specific.Tier0
			}
			if len(specific.Tier1) > 0 {
				h.Tier1 = specific.Tier1
			}
		}
	}

	if len(h.Tier0) == 0 && len(h.Tier1) == 0 {
		return nil
	}
	return &h
}

func loadYAML(path string) *harnessFile {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var f harnessFile
	if err := yaml.Unmarshal(data, &f); err != nil {
		return nil
	}
	return &f
}

// CommandRunner executes a shell command and returns the result.
// Extracted as a variable for testing.
var CommandRunner = defaultRunner

func defaultRunner(workdir, command string) Result {
	start := time.Now()
	cmd := exec.Command("sh", "-c", command)
	cmd.Dir = workdir

	var stdout, stderr strings.Builder
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return Result{
		Command:  command,
		ExitCode: exitCode,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		Duration: time.Since(start),
	}
}

// RunHarness executes the harness commands in tier order.
// Tier0 runs first; if any tier0 command fails, tier1 is skipped.
// Within a tier, commands run sequentially and stop on first failure.
func RunHarness(workdir string, h *Harness) *RunReport {
	report := &RunReport{Passed: true}

	// Tier 0
	for _, cmd := range h.Tier0 {
		r := CommandRunner(workdir, cmd)
		r.Tier = "tier0"
		report.Results = append(report.Results, r)
		if r.ExitCode != 0 {
			report.Passed = false
			return report // tier0 failure skips tier1
		}
	}

	// Tier 1
	for _, cmd := range h.Tier1 {
		r := CommandRunner(workdir, cmd)
		r.Tier = "tier1"
		report.Results = append(report.Results, r)
		if r.ExitCode != 0 {
			report.Passed = false
			return report
		}
	}

	return report
}

// FormatReport returns a human-readable summary of the run report.
func FormatReport(report *RunReport) string {
	var b strings.Builder
	for _, r := range report.Results {
		status := "✓"
		if r.ExitCode != 0 {
			status = "✗"
		}
		fmt.Fprintf(&b, "  %s [%s] %s (%s)\n", status, r.Tier, r.Command, r.Duration.Round(time.Millisecond))
		if r.ExitCode != 0 {
			if r.Stderr != "" {
				// Truncate long output
				stderr := r.Stderr
				if len(stderr) > 2000 {
					stderr = stderr[:2000] + "\n    ... (truncated)"
				}
				fmt.Fprintf(&b, "    stderr: %s\n", strings.TrimSpace(stderr))
			}
		}
	}
	return b.String()
}
