# Bugs & TODOs — Kiro Integration

## P2 — Improvements

### TODO: Session rotation for long-running agents
- **Scope:** System agents that run for hours/days.
- **Approach:** `gt handoff` to fresh session periodically, preserving state via mail/hooks.
- **Note:** May not be needed if `/compact` works well enough. Monitor and decide.

### TODO: Simpler Witness loop for non-hook agents
- **Current:** Witness does full patrol (survey, mail, verify, refinery check) — lots of context.
- **Proposal:** For Kiro-based witnesses, run a minimal loop: check tmux alive, check bead status, restart dead things. Less LLM reasoning, less context growth.

## Resolved

### FIXED: Post-merge consistency — push unpushed merges
- **Symptom:** Refinery merged locally but session died before `git push`. Code existed only on local detached commit. Beads closed, polecats respawned to redo work.
- **Fix:** Daemon heartbeat compares each rig's working branch HEAD with origin via `ls-remote`. If local is ahead, pushes automatically.

### FIXED: Polecats and refinery default to main instead of working branch
- **Symptom:** All polecats branched from and merged into `main` instead of the feature branch.
- **Fix:** Added `base_branch` field to `RigConfig` and `WorkingBranch()` method to `Rig`. Wired into refinery MR target resolution, merge slot serialization, and MQ integration branch creation.

### FIXED: Nudge event spam corrupts refinery session
- **Symptom:** Multiple GE_READY events flooded the refinery's pane, causing it to land in vim and stall.
- **Fix:** Nudge deduplication — identical messages from the same sender within 30s are collapsed into one.

### FIXED: Pane inspection for sick sessions (ValidationException, model selection, staleness)
- **Symptom:** Polecat sessions alive but non-functional (API error, model prompt, stale). Daemon only checked session existence, not health.
- **Fix:** `checkPolecatSessionSickness()` captures pane content and detects: `ValidationException` → kill + re-sling, `Select model` → send Enter, unchanged pane across heartbeats → nudge. Working agents (`⠋ Thinking`) are never flagged.

### FIXED: Pre-flight rig validation in `gt sling`
- **Symptom:** Sling retried 10 times on permanently broken config (missing custom types).
- **Fix:** `validateRigReady()` calls `beads.EnsureCustomTypes` before `resolveTarget`. Auto-fixes missing types or returns actionable error.

### FIXED: Per-rig doctor check
- **Symptom:** `gt doctor` only checked town-level beads DB, not individual rigs.
- **Fix:** `CustomTypesCheck` now iterates all rigs from `rigs.json` and checks each rig's beads DB. `--fix` registers types per-rig.

### FIXED: Retirement limbo detection
- **Symptom:** Polecat waiting for retirement while witness sleeps after boot race.
- **Fix:** Daemon pane inspection detects "Waiting for retirement" and nudges witness directly via tmux send-keys.

### FIXED: Auto-respawn orphaned polecats
- **Symptom:** After reboot, polecats with hooked beads had no tmux session. Daemon notified witness but didn't respawn directly.
- **Fix:** After crash detection, daemon now re-slings the hooked bead directly via `gt sling --force`.

### FIXED: GT/beads split-brain initialization (mitigated)
- **Symptom:** `bd init --force` created vanilla DB missing GT's custom types. Silent failures cascaded.
- **Fix:** `validateRigReady()` auto-fixes on next sling. Per-rig doctor check catches it. Root cause (separate init models) still exists but impact is fully mitigated.

### FIXED: Non-Claude agents get hardcoded Claude start command (commit `f106215d`)
- **Symptom:** Witnesses failed with `exit status 127: exec claude --dangerously-skip-permissions` when default agent was Kiro.
- **Fix:** Changed `||` to `&&` in TOML start_command guard so non-Claude agents fall through to config-based startup.

### FIXED: Polecat session reuse skips cold-start injection (commit `1f719d72`)
- **Symptom:** Reused idle polecat gets no work instructions.
- **Fix:** `SpawnedPolecatInfo` carries the hooked bead ID through the session reuse path.

### FIXED: Startup nudge not delivered to polecats (commits `cb58b57e`, `1f719d72`)
- **Symptom:** Polecat starts at blank prompt, never receives work.
- **Fix:** Beacon CLI arg for fresh spawns + session reuse path injection.

### FIXED: Witness crashes from context accumulation
- **Symptom:** Witness context grows until Bedrock rejects with `ValidationException`.
- **Fix:** Auto-compact via daemon heartbeat. Kiro preset: `/compact` at 50% context usage.

### FIXED: macOS ASP kills gt binary after re-evaluation
- **Symptom:** `gt` commands fail with SIGKILL from corporate endpoint security.
- **Fix:** `scripts/install-local.sh` runs `codesign --force --sign -` after every build.

### FIXED: Kiro preset used --no-interactive (commit `3872018b`)
- Removed flag; Kiro stays alive in tmux for follow-up work.

### FIXED: Kiro resume flag incompatible with Gas Town (commit `e5fabb8b`)
- Moved to `ContinueFlag`, cleared `ResumeFlag`.
