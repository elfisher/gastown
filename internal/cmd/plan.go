package cmd

import (
	"fmt"
	"os/exec"
	"strings"

	"github.com/spf13/cobra"
	"github.com/steveyegge/gastown/internal/nudge"
	"github.com/steveyegge/gastown/internal/session"
	"github.com/steveyegge/gastown/internal/style"
	"github.com/steveyegge/gastown/internal/templates"
)

var planCmd = &cobra.Command{
	Use:     "plan <rig> <goal>",
	GroupID: GroupWork,
	Short:   "Send a planning prompt to the Mayor for goal-to-convoy breakdown",
	Long: `Render the planning prompt template with rig context and send it to the Mayor.

The Mayor will explore the codebase, break the goal into tasks with parallel
groups, present a table for approval, then create beads and a convoy.

Example:
  gt plan gastown "Add a dashboard page for viewing agent logs"
  gt plan myproject "Implement OAuth2 login flow"`,
	Args: cobra.ExactArgs(2),
	RunE: runPlan,
}

func init() {
	rootCmd.AddCommand(planCmd)
}

func runPlan(cmd *cobra.Command, args []string) error {
	rigName := args[0]
	goal := args[1]

	townRoot, r, err := getRig(rigName)
	if err != nil {
		return err
	}

	// Get open beads summary
	beadsSummary := getOpenBeadsSummary(r.BeadsPath())

	// Resolve git URL and branch
	gitURL := r.GitURL
	baseBranch := r.WorkingBranch()

	// Render the planning prompt template
	tmpl, err := templates.New()
	if err != nil {
		return fmt.Errorf("loading templates: %w", err)
	}

	data := templates.PlanData{
		RigName:         rigName,
		GitURL:          gitURL,
		BaseBranch:      baseBranch,
		OpenBeadSummary: beadsSummary,
		Goal:            goal,
	}

	rendered, err := tmpl.RenderMessage("plan", data)
	if err != nil {
		return fmt.Errorf("rendering plan template: %w", err)
	}

	// Send to mayor via nudge
	mayorSession := session.MayorSessionName()
	err = nudge.Enqueue(townRoot, mayorSession, nudge.QueuedNudge{
		Sender:  "human",
		Message: rendered,
	})
	if err != nil {
		return fmt.Errorf("sending plan to mayor: %w", err)
	}

	fmt.Fprintf(cmd.OutOrStdout(), "%s Planning prompt sent to Mayor for rig %s\n",
		style.Success.Render("✓"), style.Bold.Render(rigName))
	fmt.Fprintf(cmd.OutOrStdout(), "  Goal: %s\n", goal)
	fmt.Fprintf(cmd.OutOrStdout(), "  Branch: %s\n", baseBranch)
	fmt.Fprintf(cmd.OutOrStdout(), "\nAttach to the Mayor to interact with the plan:\n")
	fmt.Fprintf(cmd.OutOrStdout(), "  gt mayor attach\n")

	return nil
}

// getOpenBeadsSummary runs bd list --status=open and returns the output.
func getOpenBeadsSummary(beadsPath string) string {
	out, err := exec.Command("bd", "list", "--status=open", "--dir", beadsPath).CombinedOutput()
	if err != nil {
		return ""
	}
	s := strings.TrimSpace(string(out))
	if s == "" || strings.Contains(s, "No issues found") {
		return ""
	}
	return s
}
