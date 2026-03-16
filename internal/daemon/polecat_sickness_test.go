package daemon

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/steveyegge/gastown/internal/tmux"
)

// writeFakeTestTmuxAlive creates a fake tmux that reports the session as alive
// and returns paneContent for capture-pane calls. This simulates a session that
// exists but may be sick (stuck on error, interactive prompt, etc.).
func writeFakeTestTmuxAlive(t *testing.T, dir, paneContent string) {
	t.Helper()
	// Escape single quotes in pane content for shell safety
	escaped := strings.ReplaceAll(paneContent, "'", "'\\''")
	script := "#!/bin/sh\n" +
		"case \"$*\" in\n" +
		"  *has-session*) exit 0;;\n" +
		"  *capture-pane*) echo '" + escaped + "';;\n" +
		"  *send-keys*) echo \"send-keys: $*\" >> \"" + dir + "/tmux-sends.log\";;\n" +
		"  *) echo 'unexpected tmux command' >&2; exit 1;;\n" +
		"esac\n"
	if err := os.WriteFile(filepath.Join(dir, "tmux"), []byte(script), 0755); err != nil {
		t.Fatalf("writing fake tmux: %v", err)
	}
}

// --- Tier 1: Specific pane pattern detection ---

// TestCheckPolecatHealth_MissesValidationException is a NEGATIVE test proving
// the daemon does NOT detect a polecat whose session is alive but the agent
// hit a ValidationException and is sitting at a dead prompt.
//
// EXPECTED AFTER FIX: daemon detects SICK_SESSION and triggers kill + re-sling.
func TestCheckPolecatHealth_MissesValidationException(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	paneContent := "ValidationException: Improperly formed request\n\n17% !>"
	writeFakeTestTmuxAlive(t, binDir, paneContent)
	recentTime := time.Now().UTC().Format(time.RFC3339)
	bdPath := writeFakeTestBD(t, binDir, "working", "working", "gt-xyz", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: t.TempDir()},
		logger: log.New(&logBuf, "", 0),
		tmux:   tmux.NewTmux(),
		bdPath: bdPath,
	}

	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// NEGATIVE: current code sees session alive and does nothing.
	// It does NOT detect the ValidationException in the pane.
	if strings.Contains(got, "SICK_SESSION") || strings.Contains(got, "CRASH DETECTED") {
		t.Errorf("current code should NOT detect sick session, but got: %q", got)
	}
	// After fix, flip this assertion:
	// if !strings.Contains(got, "SICK_SESSION") {
	//     t.Errorf("expected SICK_SESSION for ValidationException in pane, got: %q", got)
	// }
}

// TestCheckPolecatHealth_MissesModelSelectionPrompt is a NEGATIVE test proving
// the daemon does NOT detect a polecat stuck on Kiro's interactive model
// selection UI. The session is alive but the agent can't proceed without
// human input.
//
// EXPECTED AFTER FIX: daemon detects MODEL_PROMPT_DETECTED and sends Enter
// via tmux send-keys to dismiss the prompt.
func TestCheckPolecatHealth_MissesModelSelectionPrompt(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	paneContent := "17% !> /model\n\nSelect model (type to search):\n> * claude-opus-4.6-1m    2.20x credits"
	writeFakeTestTmuxAlive(t, binDir, paneContent)
	recentTime := time.Now().UTC().Format(time.RFC3339)
	bdPath := writeFakeTestBD(t, binDir, "working", "working", "gt-xyz", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: t.TempDir()},
		logger: log.New(&logBuf, "", 0),
		tmux:   tmux.NewTmux(),
		bdPath: bdPath,
	}

	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// NEGATIVE: current code sees session alive and does nothing.
	if strings.Contains(got, "MODEL_PROMPT_DETECTED") {
		t.Errorf("current code should NOT detect model selection prompt, but got: %q", got)
	}
	// Verify no send-keys was invoked
	sendLog := filepath.Join(binDir, "tmux-sends.log")
	if _, err := os.Stat(sendLog); err == nil {
		data, _ := os.ReadFile(sendLog)
		t.Errorf("current code should NOT send keys, but tmux-sends.log exists: %q", string(data))
	}
	// After fix, flip these assertions:
	// if !strings.Contains(got, "MODEL_PROMPT_DETECTED") {
	//     t.Errorf("expected MODEL_PROMPT_DETECTED, got: %q", got)
	// }
	// data, err := os.ReadFile(sendLog)
	// if err != nil {
	//     t.Fatalf("expected tmux send-keys to be called, but log missing: %v", err)
	// }
	// if !strings.Contains(string(data), "Enter") {
	//     t.Errorf("expected Enter to be sent, got: %q", string(data))
	// }
}

// TestCheckPolecatHealth_IgnoresSickPaneWhenWorking is a POSITIVE guard test.
// When the agent is actively working (Thinking... indicator visible), the daemon
// must NOT flag the session as sick even if stale error text exists in scrollback.
//
// This test should pass BOTH before and after the fix.
func TestCheckPolecatHealth_IgnoresSickPaneWhenWorking(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	// Pane has an old error in scrollback but agent is currently working
	paneContent := "ValidationException: Improperly formed request\n\n⠋ Thinking..."
	writeFakeTestTmuxAlive(t, binDir, paneContent)
	recentTime := time.Now().UTC().Format(time.RFC3339)
	bdPath := writeFakeTestBD(t, binDir, "working", "working", "gt-xyz", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: t.TempDir()},
		logger: log.New(&logBuf, "", 0),
		tmux:   tmux.NewTmux(),
		bdPath: bdPath,
	}

	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// Session is alive and agent is working — no action should be taken.
	if strings.Contains(got, "SICK_SESSION") || strings.Contains(got, "CRASH DETECTED") || strings.Contains(got, "MODEL_PROMPT_DETECTED") {
		t.Errorf("working agent must not be flagged as sick, got: %q", got)
	}
}

// --- Tier 2: Generic staleness detection ---

// TestCheckPolecatHealth_MissesStaleSession is a NEGATIVE test proving the
// daemon does NOT detect a session whose pane content is unchanged across
// two heartbeat checks while the polecat has work on hook.
//
// EXPECTED AFTER FIX: daemon detects STALE_SESSION on second check, nudges
// the agent. On third check if still stale, kills and re-slings.
func TestCheckPolecatHealth_MissesStaleSession(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	// Pane shows idle prompt — no error, no working indicator, just sitting there
	paneContent := "17% !>"
	writeFakeTestTmuxAlive(t, binDir, paneContent)
	recentTime := time.Now().UTC().Format(time.RFC3339)
	bdPath := writeFakeTestBD(t, binDir, "working", "working", "gt-xyz", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config:          &Config{TownRoot: t.TempDir()},
		logger:          log.New(&logBuf, "", 0),
		tmux:            tmux.NewTmux(),
		bdPath:          bdPath,
		postWakeStalled: make(map[string]time.Time),
	}

	// First check — should record the pane snapshot
	d.checkPolecatHealth("myr", "mycat")
	// Second check — pane unchanged, should detect staleness
	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// NEGATIVE: current code sees session alive both times and does nothing.
	if strings.Contains(got, "STALE_SESSION") {
		t.Errorf("current code should NOT detect stale session, but got: %q", got)
	}
	// After fix, flip this assertion:
	// if !strings.Contains(got, "STALE_SESSION") {
	//     t.Errorf("expected STALE_SESSION on second check, got: %q", got)
	// }
}

// TestCheckPolecatHealth_StaleSessionWithNoHook is a POSITIVE guard test.
// An idle polecat with no hooked work is allowed to have an unchanged pane.
// The daemon must NOT flag it as stale.
//
// This test should pass BOTH before and after the fix.
func TestCheckPolecatHealth_StaleSessionWithNoHook(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	paneContent := "17% !>"
	writeFakeTestTmuxAlive(t, binDir, paneContent)
	recentTime := time.Now().UTC().Format(time.RFC3339)
	// No hook bead — polecat is idle
	bdPath := writeFakeTestBD(t, binDir, "idle", "idle", "", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config:          &Config{TownRoot: t.TempDir()},
		logger:          log.New(&logBuf, "", 0),
		tmux:            tmux.NewTmux(),
		bdPath:          bdPath,
		postWakeStalled: make(map[string]time.Time),
	}

	d.checkPolecatHealth("myr", "mycat")
	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	if strings.Contains(got, "STALE_SESSION") || strings.Contains(got, "SICK_SESSION") || strings.Contains(got, "CRASH DETECTED") {
		t.Errorf("idle polecat with no hook must not be flagged, got: %q", got)
	}
}

// --- Pre-sling rig validation ---

// TestSlingPreflight_MissingCustomTypes is a NEGATIVE test proving that
// no pre-flight validation exists for rig beads configuration.
//
// EXPECTED AFTER FIX: validateRigReady() returns an error when the rig's
// beads DB is missing the "agent" custom type.
func TestSlingPreflight_MissingCustomTypes(t *testing.T) {
	// Create a minimal rig directory with a beads config that has no custom types
	townRoot := t.TempDir()
	rigPath := filepath.Join(townRoot, "myr")
	beadsDir := filepath.Join(rigPath, ".beads")
	if err := os.MkdirAll(beadsDir, 0755); err != nil {
		t.Fatal(err)
	}
	// Write a config.yaml with no custom types
	configYAML := "issue_prefix: my\n"
	if err := os.WriteFile(filepath.Join(beadsDir, "config.yaml"), []byte(configYAML), 0644); err != nil {
		t.Fatal(err)
	}

	// NEGATIVE: validateRigReady doesn't exist yet.
	// This test documents that the function should exist and catch this case.
	//
	// After fix:
	// err := validateRigReady(townRoot, "myr")
	// if err == nil {
	//     t.Error("expected validateRigReady to fail for rig missing custom types")
	// }
	// if !strings.Contains(err.Error(), "agent") {
	//     t.Errorf("expected error to mention missing 'agent' type, got: %v", err)
	// }

	// For now, just verify the function doesn't exist by documenting the gap
	t.Log("NEGATIVE TEST: validateRigReady() does not exist yet — rig validation is not performed before sling")
}

// TestSlingPreflight_ValidRig is a POSITIVE guard test.
// A properly configured rig should pass validation.
//
// This test should pass after the fix is implemented.
func TestSlingPreflight_ValidRig(t *testing.T) {
	townRoot := t.TempDir()
	rigPath := filepath.Join(townRoot, "myr")
	beadsDir := filepath.Join(rigPath, ".beads")
	if err := os.MkdirAll(beadsDir, 0755); err != nil {
		t.Fatal(err)
	}
	configYAML := "issue_prefix: my\ntypes:\n  custom: agent,role,rig,convoy,slot,queue,event,message,molecule,gate,merge-request\n"
	if err := os.WriteFile(filepath.Join(beadsDir, "config.yaml"), []byte(configYAML), 0644); err != nil {
		t.Fatal(err)
	}

	// After fix:
	// err := validateRigReady(townRoot, "myr")
	// if err != nil {
	//     t.Errorf("expected valid rig to pass validation, got: %v", err)
	// }

	t.Log("POSITIVE GUARD: validateRigReady() does not exist yet — will verify valid rigs pass once implemented")
}

// --- Doctor per-rig validation ---

// TestDoctorCheck_PerRigTypes is a NEGATIVE test proving that gt doctor
// only checks the town-level beads DB, not individual rig DBs.
//
// EXPECTED AFTER FIX: doctor check iterates all rigs and catches the
// broken one.
func TestDoctorCheck_PerRigTypes(t *testing.T) {
	// This test documents the gap. The actual doctor check functions are in
	// internal/doctor/ and would need their own test file. We document the
	// expected behavior here for the test plan.
	//
	// Setup: town-level DB has custom types, rig "myr" DB is missing them.
	// Current: doctor reports all clear.
	// After fix: doctor reports failure for "myr".

	t.Log("NEGATIVE TEST: gt doctor beads-custom-types check does not validate per-rig DBs")
}

// --- Boot race condition ---

// TestHeartbeat_DetectsRetirementLimbo is a NEGATIVE test proving the daemon
// does NOT detect a polecat stuck in "waiting for retirement" when the refinery
// is alive but the witness is sleeping.
//
// EXPECTED AFTER FIX: daemon detects the limbo state and nudges the witness.
func TestHeartbeat_DetectsRetirementLimbo(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	// Witness pane shows it went to sleep
	writeFakeTestTmuxAlive(t, binDir, "Patrol complete. Sleeping until new activity.")
	recentTime := time.Now().UTC().Format(time.RFC3339)
	// Polecat is waiting for retirement with a hook bead
	bdPath := writeFakeTestBD(t, binDir, "waiting-for-retirement", "waiting-for-retirement", "gt-xyz", recentTime)

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config:          &Config{TownRoot: t.TempDir()},
		logger:          log.New(&logBuf, "", 0),
		tmux:            tmux.NewTmux(),
		bdPath:          bdPath,
		postWakeStalled: make(map[string]time.Time),
	}

	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// NEGATIVE: current code sees session alive (polecat has a tmux session
	// because it's waiting for retirement) and does nothing about the limbo state.
	if strings.Contains(got, "RETIREMENT_LIMBO") {
		t.Errorf("current code should NOT detect retirement limbo, but got: %q", got)
	}
	// After fix:
	// if !strings.Contains(got, "RETIREMENT_LIMBO") {
	//     t.Errorf("expected RETIREMENT_LIMBO detection, got: %q", got)
	// }
	// Verify witness was nudged
	// sendLog := filepath.Join(binDir, "tmux-sends.log")
	// data, _ := os.ReadFile(sendLog)
	// if !strings.Contains(string(data), "witness") {
	//     t.Errorf("expected witness to be nudged, got: %q", string(data))
	// }
}

// --- Reboot recovery ---

// TestHeartbeat_OrphanedPolecatNotRespawned is a NEGATIVE test proving that
// while the daemon detects crashed polecats (dead session + hooked work),
// it only notifies the witness — it does NOT auto-respawn the polecat.
// After a reboot, this means orphaned polecats depend on the witness being
// alive and responsive to recover, which may not happen (see boot race).
//
// EXPECTED AFTER FIX: daemon auto-respawns orphaned polecats directly
// (or dispatches a re-sling) instead of only notifying the witness.
func TestHeartbeat_OrphanedPolecatNotRespawned(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("test uses Unix shell script mocks")
	}
	binDir := t.TempDir()
	writeFakeTestTmux(t, binDir) // Session is dead
	recentTime := time.Now().UTC().Format(time.RFC3339)
	bdPath := writeFakeTestBD(t, binDir, "working", "working", "gt-xyz", recentTime)

	// Create a fake gt that logs invocations
	gtLog := filepath.Join(t.TempDir(), "gt-invocations.log")
	fakeGt := filepath.Join(binDir, "gt")
	gtScript := fmt.Sprintf("#!/bin/sh\necho \"$@\" >> %s\n", gtLog)
	if err := os.WriteFile(fakeGt, []byte(gtScript), 0755); err != nil {
		t.Fatalf("writing fake gt: %v", err)
	}

	t.Setenv("PATH", binDir+":"+os.Getenv("PATH"))

	var logBuf strings.Builder
	d := &Daemon{
		config: &Config{TownRoot: t.TempDir()},
		logger: log.New(&logBuf, "", 0),
		tmux:   tmux.NewTmux(),
		bdPath: bdPath,
		gtPath: fakeGt,
	}

	d.checkPolecatHealth("myr", "mycat")

	got := logBuf.String()
	// Current code DOES detect the crash
	if !strings.Contains(got, "CRASH DETECTED") {
		t.Fatalf("expected CRASH DETECTED for dead session with hooked work, got: %q", got)
	}

	// But it only notifies the witness — does NOT respawn directly
	gtData, err := os.ReadFile(gtLog)
	if err != nil {
		t.Fatalf("expected gt to be invoked, but log missing: %v", err)
	}
	invocations := string(gtData)
	if !strings.Contains(invocations, "mail send") {
		t.Errorf("expected gt mail send (witness notification), got: %q", invocations)
	}
	// NEGATIVE: no direct respawn or re-sling
	if strings.Contains(invocations, "sling") {
		t.Errorf("current code should NOT auto-sling, but got: %q", invocations)
	}
	// After fix:
	// if !strings.Contains(invocations, "sling") {
	//     t.Errorf("expected auto-sling for orphaned polecat, got: %q", invocations)
	// }
}
