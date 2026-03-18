# Bugs & TODOs — Kiro Integration

## P2 — Improvements

### TODO: Daemon JSON API for dashboard
- **Symptom:** Dashboard page loads are slow (1-2s) because every page shells out to multiple CLI commands (`gt rig list`, `bd list`, `tmux capture-pane`). Each is a cold Go binary invocation hitting Dolt.
- **Fix:** The daemon already has all the state in memory (rigs, agents, polecats, session health). Expose a lightweight JSON API from the daemon (e.g., `localhost:8082/api/status`) that the dashboard reads instead of shelling out. One HTTP call vs N process spawns.
- **Interim:** Cache CLI output in the dashboard's Fastify server with a short TTL (5-10s). htmx polling refreshes it.

## Resolved

### FIXED: Kiro stop hook support — event-driven agent wake-up
- **Symptom:** Kiro agents went idle and couldn't be woken by events. Nudges queued up forever. Had to manually type into tmux pane.
- **Root cause:** GT's Kiro preset had `SupportsHooks: false` even though Kiro CLI supports hooks including Stop hooks.
- **Fix:** Enabled hooks on Kiro preset. Added hook templates (`internal/hooks/templates/kiro/`). Added `gt signal kiro-stop` command that checks for pending work at turn boundaries and injects via tmux send-keys.

### FIXED: WorkingBranch wired everywhere
- **Symptom:** Polecat auto-respawns, crew workers, and orphan detection all used `DefaultBranch()` (main) instead of `WorkingBranch()` (base_branch from config).
- **Fix:** Changed `DefaultBranch()` to `WorkingBranch()` in polecat_spawn.go, crew/manager.go, orphans.go. Pre-push hook reads base_branch from config.json.

### FIXED: CI=true suppresses npm/npx interactive prompts
- **Symptom:** npx prompts "Need to install X, proceed?" which hangs autonomous polecats.
- **Fix:** Set `CI=true` in all agent sessions via `AgentEnv()`.

### FIXED: GT.md agent-agnostic operational harness
- **Symptom:** CLAUDE.md was the only operational harness. Non-Claude agents had no equivalent.
- **Fix:** `gt upgrade` generates GT.md from embedded template. AGENTS.md references GT.md. `gt prime` output points agents to both files. CLAUDE.md left untouched for backward compat.

### FIXED: Post-merge consistency — push unpushed merges
- **Symptom:** Refinery merged locally but session died before `git push`. Code existed only on local detached commit.
- **Fix:** Daemon heartbeat compares each rig's working branch HEAD with origin via `ls-remote`. If local is ahead, pushes automatically.

### FIXED: Polecats and refinery default to main instead of working branch
- **Symptom:** All polecats branched from and merged into `main` instead of the feature branch.
- **Fix:** Added `base_branch` field to `RigConfig` and `WorkingBranch()` method. Wired into refinery, MQ integration, merge slot serialization.

### FIXED: Nudge event spam corrupts refinery session
- **Symptom:** Multiple GE_READY events flooded the refinery's pane.
- **Fix:** Nudge deduplication — identical messages from the same sender within 30s are collapsed.

### FIXED: Pane inspection for sick sessions
- **Symptom:** Polecat sessions alive but non-functional (API error, model prompt, stale).
- **Fix:** `checkPolecatSessionSickness()` detects: `ValidationException` → kill + re-sling, `Select model` → send Enter, unchanged pane → nudge.

### FIXED: Pre-flight rig validation in `gt sling`
- **Symptom:** Sling retried 10 times on permanently broken config.
- **Fix:** `validateRigReady()` auto-fixes missing types before spawning.

### FIXED: Per-rig doctor check
- **Symptom:** `gt doctor` only checked town-level beads DB.
- **Fix:** `CustomTypesCheck` iterates all rigs from `rigs.json`.

### FIXED: Retirement limbo detection
- **Symptom:** Polecat waiting for retirement while witness sleeps.
- **Fix:** Daemon pane inspection detects "Waiting for retirement" and nudges witness.

### FIXED: Auto-respawn orphaned polecats
- **Symptom:** After reboot, polecats with hooked beads had no tmux session.
- **Fix:** Daemon re-slings the hooked bead directly via `gt sling --force`.

### FIXED: GT/beads split-brain initialization (mitigated)
- **Symptom:** `bd init --force` created vanilla DB missing GT's custom types.
- **Fix:** `validateRigReady()` auto-fixes on next sling. Per-rig doctor check catches it.

### FIXED: Non-Claude agents get hardcoded Claude start command
- **Fix:** Changed `||` to `&&` in TOML start_command guard.

### FIXED: Polecat session reuse skips cold-start injection
- **Fix:** `SpawnedPolecatInfo` carries hooked bead ID through session reuse path.

### FIXED: Startup nudge not delivered to polecats
- **Fix:** Beacon CLI arg for fresh spawns + session reuse path injection.

### FIXED: Witness crashes from context accumulation
- **Fix:** Auto-compact via daemon heartbeat at 50% context usage.

### FIXED: macOS ASP kills gt binary after re-evaluation
- **Fix:** `scripts/install-local.sh` runs `codesign --force --sign -` after every build.

### FIXED: Kiro preset used --no-interactive
- **Fix:** Removed flag; Kiro stays alive in tmux.

### FIXED: Kiro resume flag incompatible with Gas Town
- **Fix:** Moved to `ContinueFlag`, cleared `ResumeFlag`.
