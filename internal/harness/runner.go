// Package harness executes verification commands sequentially, stopping on
// first failure and returning structured results per command.
package harness

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// CommandResult holds the outcome of a single command execution.
type CommandResult struct {
	Command  string        `json:"command"`
	ExitCode int           `json:"exit_code"`
	Stdout   string        `json:"stdout"`
	Stderr   string        `json:"stderr"`
	Elapsed  time.Duration `json:"elapsed"`
}

// Result holds the aggregate outcome of a harness run.
type Result struct {
	Success  bool            `json:"success"`
	Results  []CommandResult `json:"results"`
	FailedAt int             `json:"failed_at"` // -1 if all passed
}

// RunHarness executes commands sequentially in workdir, stopping on first
// failure. Returns structured results for each command that was run.
func RunHarness(ctx context.Context, workdir string, commands []string) Result {
	res := Result{FailedAt: -1}

	for i, cmdStr := range commands {
		cr := runOne(ctx, workdir, cmdStr)
		res.Results = append(res.Results, cr)

		if cr.ExitCode != 0 {
			res.FailedAt = i
			return res
		}

		if ctx.Err() != nil {
			res.FailedAt = i
			return res
		}
	}

	res.Success = true
	return res
}

// RunTiered executes command tiers in order. Each tier is a slice of commands
// run sequentially. If any command in a tier fails, subsequent tiers are skipped.
func RunTiered(ctx context.Context, workdir string, tiers [][]string) Result {
	var all []CommandResult
	failedAt := -1
	idx := 0

	for _, tier := range tiers {
		for _, cmdStr := range tier {
			cr := runOne(ctx, workdir, cmdStr)
			all = append(all, cr)

			if cr.ExitCode != 0 {
				failedAt = idx
				return Result{Results: all, FailedAt: failedAt}
			}

			if ctx.Err() != nil {
				failedAt = idx
				return Result{Results: all, FailedAt: failedAt}
			}
			idx++
		}
	}

	return Result{Success: true, Results: all, FailedAt: -1}
}

func runOne(ctx context.Context, workdir, cmdStr string) CommandResult {
	start := time.Now()

	if strings.TrimSpace(cmdStr) == "" {
		return CommandResult{
			Command:  cmdStr,
			ExitCode: 1,
			Stderr:   "empty command",
			Elapsed:  time.Since(start),
		}
	}

	//nolint:gosec // G204: commands come from trusted rig config
	cmd := exec.CommandContext(ctx, "sh", "-c", cmdStr)
	cmd.Dir = workdir
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	elapsed := time.Since(start)

	exitCode := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			exitCode = ee.ExitCode()
		} else {
			exitCode = 1
		}
	}

	return CommandResult{
		Command:  cmdStr,
		ExitCode: exitCode,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
		Elapsed:  elapsed,
	}
}

// Summary returns a human-readable summary of the harness result.
func (r Result) Summary() string {
	if r.Success {
		return fmt.Sprintf("all %d commands passed", len(r.Results))
	}
	if r.FailedAt >= 0 && r.FailedAt < len(r.Results) {
		cr := r.Results[r.FailedAt]
		return fmt.Sprintf("failed at command %d: %s (exit %d)", r.FailedAt, cr.Command, cr.ExitCode)
	}
	return "unknown failure"
}
