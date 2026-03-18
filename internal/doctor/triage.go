package doctor

import (
	"fmt"
	"io"
	"time"

	"github.com/steveyegge/gastown/internal/ui"
)

// CategoryTriage is the category for triage-specific checks.
const CategoryTriage = "Triage"

func init() {
	CategoryOrder = append(CategoryOrder, CategoryTriage)
}

// TriageCheck defines the interface for triage-specific health checks.
// These run only when --triage is passed to gt doctor.
type TriageCheck interface {
	Check // Embeds the standard Check interface
}

// TriageRunner manages and executes triage checks.
type TriageRunner struct {
	checks []TriageCheck
}

// NewTriageRunner creates a new TriageRunner with no registered checks.
func NewTriageRunner() *TriageRunner {
	return &TriageRunner{checks: make([]TriageCheck, 0)}
}

// Register adds a triage check.
func (tr *TriageRunner) Register(check TriageCheck) {
	tr.checks = append(tr.checks, check)
}

// RegisterAll adds multiple triage checks.
func (tr *TriageRunner) RegisterAll(checks ...TriageCheck) {
	tr.checks = append(tr.checks, checks...)
}

// Checks returns the registered triage checks.
func (tr *TriageRunner) Checks() []TriageCheck {
	return tr.checks
}

// Run executes all triage checks and appends results to the given report.
// Uses the same streaming output format as Doctor.RunStreaming.
func (tr *TriageRunner) Run(ctx *CheckContext, report *Report, w io.Writer, slowThreshold time.Duration) {
	if len(tr.checks) == 0 {
		return
	}

	// Print triage section header
	if w != nil {
		fmt.Fprintln(w, ui.RenderCategory(CategoryTriage))
	}

	for _, check := range tr.checks {
		if w != nil {
			fmt.Fprintf(w, "  %s  %s...", ui.RenderMuted("○"), check.Name())
		}

		start := time.Now()
		result := check.Run(ctx)
		result.Elapsed = time.Since(start)

		if result.Name == "" {
			result.Name = check.Name()
		}
		if result.Category == "" {
			result.Category = CategoryTriage
		}

		if w != nil {
			var statusIcon string
			switch result.Status {
			case StatusOK:
				statusIcon = ui.RenderPassIcon()
			case StatusWarning:
				statusIcon = ui.RenderWarnIcon()
			case StatusError:
				statusIcon = ui.RenderFailIcon()
			}
			isSlow := slowThreshold > 0 && result.Elapsed >= slowThreshold
			slowIndicator := "  "
			if isSlow {
				report.Summary.Slow++
				slowIndicator = "⏳"
			}
			fmt.Fprintf(w, "\r  %s%s%s", statusIcon, slowIndicator, result.Name)
			if result.Message != "" {
				fmt.Fprintf(w, "%s", ui.RenderMuted(" "+result.Message))
			}
			if isSlow {
				fmt.Fprintf(w, "%s", ui.RenderMuted(" ("+formatDuration(result.Elapsed)+")"))
			}
			fmt.Fprintln(w)
		}

		report.Add(result)
	}
}

// Fix executes all triage checks with auto-fix, appending results to the report.
func (tr *TriageRunner) Fix(ctx *CheckContext, report *Report, w io.Writer, slowThreshold time.Duration) {
	if len(tr.checks) == 0 {
		return
	}

	if w != nil {
		fmt.Fprintln(w, ui.RenderCategory(CategoryTriage))
	}

	for _, check := range tr.checks {
		if w != nil {
			fmt.Fprintf(w, "  %s  %s...", ui.RenderMuted("○"), check.Name())
		}

		start := time.Now()
		result := check.Run(ctx)
		if result.Name == "" {
			result.Name = check.Name()
		}
		if result.Category == "" {
			result.Category = CategoryTriage
		}

		// Attempt fix if failed and fixable
		if result.Status != StatusOK && check.CanFix() {
			if w != nil {
				var problemIcon string
				if result.Status == StatusError {
					problemIcon = ui.RenderFailIcon()
				} else {
					problemIcon = ui.RenderWarnIcon()
				}
				fmt.Fprintf(w, "\r  %s  %s", problemIcon, check.Name())
				if result.Message != "" {
					fmt.Fprintf(w, "%s", ui.RenderMuted(" "+result.Message))
				}
				fmt.Fprintf(w, "%s", ui.RenderMuted(" (fixing)..."))
			}

			err := safeFixCheck(check, ctx)
			if err == nil {
				result = check.Run(ctx)
				if result.Name == "" {
					result.Name = check.Name()
				}
				if result.Category == "" {
					result.Category = CategoryTriage
				}
				if result.Status == StatusOK {
					result.Message = result.Message + " (fixed)"
					result.Fixed = true
				}
			} else {
				result.Details = append(result.Details, "Fix failed: "+err.Error())
			}
		}

		result.Elapsed = time.Since(start)

		if w != nil {
			var statusIcon string
			if result.Fixed {
				statusIcon = ui.RenderFixIcon()
			} else {
				switch result.Status {
				case StatusOK:
					statusIcon = ui.RenderPassIcon()
				case StatusWarning:
					statusIcon = ui.RenderWarnIcon()
				case StatusError:
					statusIcon = ui.RenderFailIcon()
				}
			}
			isSlow := slowThreshold > 0 && result.Elapsed >= slowThreshold
			slowIndicator := "  "
			if result.Fixed {
				slowIndicator = " "
			}
			if isSlow {
				report.Summary.Slow++
				slowIndicator = "⏳"
			}
			fmt.Fprintf(w, "\r  %s%s%s", statusIcon, slowIndicator, result.Name)
			if result.Message != "" {
				fmt.Fprintf(w, "%s", ui.RenderMuted(" "+result.Message))
			}
			if isSlow {
				fmt.Fprintf(w, "%s", ui.RenderMuted(" ("+formatDuration(result.Elapsed)+")"))
			}
			fmt.Fprintln(w)
		}

		report.Add(result)
	}
}

// BaseTriageCheck provides a base implementation for triage checks.
type BaseTriageCheck struct {
	BaseCheck
}

// NewBaseTriageCheck creates a BaseTriageCheck with the Triage category pre-set.
func NewBaseTriageCheck(name, description string) BaseTriageCheck {
	return BaseTriageCheck{
		BaseCheck: BaseCheck{
			CheckName:        name,
			CheckDescription: description,
			CheckCategory:    CategoryTriage,
		},
	}
}
