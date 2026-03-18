package doctor

import (
	"encoding/csv"
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/steveyegge/gastown/internal/session"
	"github.com/steveyegge/gastown/internal/tmux"
)

// OrphanedWispsTriageCheck finds open wisps whose assignee has no active tmux session.
// These are wisps left behind when a polecat session died without cleanup.
// Fix: closes the orphaned wisps (safe — wisps are ephemeral).
type OrphanedWispsTriageCheck struct {
	FixableCheck
	orphans []orphanedWisp
}

type orphanedWisp struct {
	rigPath  string
	id       string
	title    string
	assignee string
}

// NewOrphanedWispsTriageCheck creates a new orphaned wisps triage check.
func NewOrphanedWispsTriageCheck() *OrphanedWispsTriageCheck {
	return &OrphanedWispsTriageCheck{
		FixableCheck: FixableCheck{
			BaseCheck: BaseCheck{
				CheckName:        "triage-orphaned-wisps",
				CheckDescription: "Find open wisps with no active polecat session",
				CheckCategory:    CategoryCleanup,
			},
		},
	}
}

// openWispsQuery selects open/in_progress wisps with their assignees.
const openWispsQuery = `SELECT id, title, assignee FROM wisps WHERE status IN ('open', 'in_progress') AND assignee != '' ORDER BY id`

// Run finds open wisps whose assignee has no active tmux session.
func (c *OrphanedWispsTriageCheck) Run(ctx *CheckContext) *CheckResult {
	c.orphans = nil

	rigs, err := discoverRigs(ctx.TownRoot)
	if err != nil {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusError,
			Message: "Failed to discover rigs",
			Details: []string{err.Error()},
		}
	}

	activeSessions := listActiveSessions()

	for _, rigName := range rigs {
		rigPath := filepath.Join(ctx.TownRoot, rigName)
		c.findOrphanedWisps(rigPath, activeSessions)
	}

	if len(c.orphans) == 0 {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusOK,
			Message: "No orphaned wisps found",
		}
	}

	details := make([]string, len(c.orphans))
	for i, o := range c.orphans {
		details[i] = fmt.Sprintf("%s: %s (assignee: %s)", o.id, o.title, o.assignee)
	}

	return &CheckResult{
		Name:    c.Name(),
		Status:  StatusWarning,
		Message: fmt.Sprintf("Found %d orphaned wisp(s) with no active session", len(c.orphans)),
		Details: details,
		FixHint: "Run 'gt doctor --triage --fix' to close orphaned wisps",
	}
}

// Fix closes orphaned wisps. Wisps are ephemeral, so this is safe.
func (c *OrphanedWispsTriageCheck) Fix(ctx *CheckContext) error {
	var lastErr error
	for _, o := range c.orphans {
		cmd := exec.Command("bd", "close", o.id, "--reason=no-changes: orphaned wisp — session dead") //nolint:gosec
		cmd.Dir = o.rigPath
		if out, err := cmd.CombinedOutput(); err != nil {
			lastErr = fmt.Errorf("close %s: %v (%s)", o.id, err, strings.TrimSpace(string(out)))
		}
	}
	return lastErr
}

func (c *OrphanedWispsTriageCheck) findOrphanedWisps(rigPath string, activeSessions map[string]bool) {
	cmd := exec.Command("bd", "sql", "--csv", openWispsQuery) //nolint:gosec
	cmd.Dir = rigPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return // wisps table may not exist
	}

	r := csv.NewReader(strings.NewReader(string(output)))
	records, err := r.ReadAll()
	if err != nil || len(records) < 2 {
		return
	}

	for _, rec := range records[1:] {
		if len(rec) < 3 {
			continue
		}
		id := strings.TrimSpace(rec[0])
		title := strings.TrimSpace(rec[1])
		assignee := strings.TrimSpace(rec[2])
		if assignee == "" {
			continue
		}

		sessionName := assigneeToSession(assignee)
		if sessionName != "" && !activeSessions[sessionName] {
			c.orphans = append(c.orphans, orphanedWisp{
				rigPath:  rigPath,
				id:       id,
				title:    title,
				assignee: assignee,
			})
		}
	}
}

// StaleHooksTriageCheck finds hooked beads whose assignee has no active tmux session.
// These are work assignments left on dead polecats.
// Not auto-fixable: stale hooks may have uncommitted work.
type StaleHooksTriageCheck struct {
	BaseCheck
	staleHooks []staleHook
}

type staleHook struct {
	id       string
	title    string
	assignee string
}

// NewStaleHooksTriageCheck creates a new stale hooks triage check.
func NewStaleHooksTriageCheck() *StaleHooksTriageCheck {
	return &StaleHooksTriageCheck{
		BaseCheck: BaseCheck{
			CheckName:        "triage-stale-hooks",
			CheckDescription: "Find hooked beads with no active tmux session",
			CheckCategory:    CategoryHooks,
		},
	}
}

// hookedBeadsQuery selects hooked beads with their assignees.
const hookedBeadsQuery = `SELECT id, title, assignee FROM issues WHERE status = 'hooked' AND assignee != '' ORDER BY id`

// Run finds hooked beads whose assignee has no active tmux session.
func (c *StaleHooksTriageCheck) Run(ctx *CheckContext) *CheckResult {
	c.staleHooks = nil

	rigs, err := discoverRigs(ctx.TownRoot)
	if err != nil {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusError,
			Message: "Failed to discover rigs",
			Details: []string{err.Error()},
		}
	}

	activeSessions := listActiveSessions()

	for _, rigName := range rigs {
		rigPath := filepath.Join(ctx.TownRoot, rigName)
		c.findStaleHooks(rigPath, activeSessions)
	}

	if len(c.staleHooks) == 0 {
		return &CheckResult{
			Name:    c.Name(),
			Status:  StatusOK,
			Message: "No stale hooks found",
		}
	}

	details := make([]string, len(c.staleHooks))
	for i, h := range c.staleHooks {
		details[i] = fmt.Sprintf("%s: %s (assignee: %s)", h.id, h.title, h.assignee)
	}

	return &CheckResult{
		Name:    c.Name(),
		Status:  StatusWarning,
		Message: fmt.Sprintf("Found %d stale hook(s) with no active session", len(c.staleHooks)),
		Details: details,
		FixHint: "Manual intervention required — stale hooks may have uncommitted work",
	}
}

func (c *StaleHooksTriageCheck) findStaleHooks(rigPath string, activeSessions map[string]bool) {
	cmd := exec.Command("bd", "sql", "--csv", hookedBeadsQuery) //nolint:gosec
	cmd.Dir = rigPath
	output, err := cmd.CombinedOutput()
	if err != nil {
		return
	}

	r := csv.NewReader(strings.NewReader(string(output)))
	records, err := r.ReadAll()
	if err != nil || len(records) < 2 {
		return
	}

	for _, rec := range records[1:] {
		if len(rec) < 3 {
			continue
		}
		id := strings.TrimSpace(rec[0])
		title := strings.TrimSpace(rec[1])
		assignee := strings.TrimSpace(rec[2])
		if assignee == "" {
			continue
		}

		sessionName := assigneeToSession(assignee)
		if sessionName != "" && !activeSessions[sessionName] {
			c.staleHooks = append(c.staleHooks, staleHook{
				id:       id,
				title:    title,
				assignee: assignee,
			})
		}
	}
}

// listActiveSessions returns a set of active tmux session names.
func listActiveSessions() map[string]bool {
	t := tmux.NewTmux()
	sessions, err := t.ListSessions()
	if err != nil {
		return nil
	}
	m := make(map[string]bool, len(sessions))
	for _, s := range sessions {
		if s != "" {
			m[s] = true
		}
	}
	return m
}

// assigneeToSession converts a beads assignee path (e.g., "gastown/polecats/dag")
// to the expected tmux session name (e.g., "gt-dag").
// Returns empty string if the assignee format is not recognized.
func assigneeToSession(assignee string) string {
	identity, err := session.ParseAddress(assignee)
	if err != nil {
		return ""
	}
	return identity.SessionName()
}
