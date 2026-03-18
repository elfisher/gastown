package cmd

import (
	"fmt"
	"os"
	"os/exec"
	"strings"
	"sync"

	"github.com/spf13/cobra"
	"github.com/steveyegge/gastown/internal/workspace"
)

func init() {
	signalCmd.AddCommand(signalKiroStopCmd)
}

var signalKiroStopCmd = &cobra.Command{
	Use:   "kiro-stop",
	Short: "Kiro stop hook handler — deliver queued work via tmux",
	Long: `Called by Kiro CLI's Stop hook at every turn boundary.

Checks for queued work or messages for the current agent.
If work is found, injects it into the tmux pane via send-keys
(Kiro's stop hook stdout is not added to agent context).

If nothing is queued, exits silently.`,
	Args:          cobra.NoArgs,
	RunE:          runSignalKiroStop,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func runSignalKiroStop(cmd *cobra.Command, args []string) error {
	address := detectSender()
	if address == "" || address == "overseer" {
		return nil
	}

	townRoot, err := workspace.FindFromCwd()
	if err != nil || townRoot == "" {
		return nil
	}

	// Check for pending work in parallel
	var mailReason, workReason string
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		mailReason = checkUnreadMail(townRoot, address)
	}()

	go func() {
		defer wg.Done()
		workReason = checkStopSlungWork(townRoot)
	}()

	wg.Wait()

	var reason string
	if mailReason != "" {
		reason = mailReason
	} else if workReason != "" {
		reason = workReason
	}

	if reason == "" {
		return nil // Nothing pending — agent stays idle
	}

	// Dedup: don't re-inject the same reason
	statePath := stopStateFilePath(address)
	state := loadStopState(statePath)
	if state != nil && state.LastReason == reason {
		return nil
	}
	saveStopState(statePath, &stopState{LastReason: reason})

	// Inject via tmux send-keys — Kiro's stop hook stdout doesn't go to context
	sessionName := os.Getenv("GT_SESSION")
	if sessionName == "" {
		// Fallback: print to stdout (won't reach agent but at least logs it)
		fmt.Println(reason)
		return nil
	}

	// Clean the reason for tmux injection (escape special chars)
	cleaned := strings.ReplaceAll(reason, "'", "'\\''")
	tmuxCmd := exec.Command("tmux", "send-keys", "-t", sessionName, cleaned, "Enter")
	return tmuxCmd.Run()
}
