# Bugs & TODOs — Kiro Integration

## P1 — Reliability

### TODO: Mayor shouldn't poll in a while loop
- **Symptom:** Mayor burns an Opus-tier LLM session sitting in `while true; sleep 30; bd show` loop.
- **Impact:** Expensive, wasteful, holds context open.
- **Fix:** Convoy system should auto-advance when polecats complete. Mayor dispatches upfront, doesn't babysit.

### TODO: Deacon auto-restart — full spec not yet implemented
- **Current state:** Daemon's `ensureWitnessesRunning()` restarts dead Witness tmux sessions on each heartbeat. Basic restart works.
- **Missing:** Idle detection (idle `!>` prompt for N minutes), max restart count (3 per 10-min window), don't-restart-if-actively-working checks, race condition guard during `gt done` / merge queue operations.

### TODO: 6 zombie tmux sessions from failed attempts
- **Symptom:** Dashboard shows "6 dead" badge.
- **Impact:** Cosmetic, but confusing.
- **Fix:** `gt cleanup` or `gt shutdown && gt up` clears them. Consider auto-pruning on startup.

## P1 — Reboot Recovery

### TODO: Auto-resume polecats on `gt start`
- **Symptom:** After a computer restart, polecats with active hooks are gone (no tmux sessions). Work is orphaned. Human must manually reconstruct project state, create new beads, and sling fresh.
- **Fix:** Serialize active polecat state (hooked bead, formula step, branch, convoy) to a persistent file before shutdown or periodically via daemon heartbeat. On `gt start`, scan for polecats with hooked beads but no tmux session and auto-respawn them.
- **Alternative:** Add `gt resume --all` as a town-level command that does the scan-and-respawn.
- **Note:** `gt up --restore` exists but didn't recover the polecats in practice.

### BUG: Idle polecat reuse doesn't start sessions
- **Symptom:** `gt sling` says "Reusing idle polecat: furiosa" and "session start deferred" — but the tmux session is never created. Polecat appears idle with stale work description. `--force` required to spawn a new polecat.
- **Root cause:** "Session start deferred" is a terminal state with no follow-through mechanism.
- **Fix:** When sling reuses an idle polecat, it must either start the tmux session immediately or ensure the daemon picks it up on the next heartbeat.

### BUG: `bd init --force` inside a GT town creates vanilla beads DB
- **Symptom:** `bd init --force --prefix dd` recreated the DB but only registered standard types (task, bug, feature). GT requires custom types (agent, molecule, convoy, etc.). Every `gt sling` attempt failed with `invalid issue type: agent` after 10 retries.
- **Fix:** When `bd init` runs inside a GT town (detectable via `GT_TOWN_ROOT` or presence of `config.yaml`), automatically register GT's custom types.
- **Alternative:** Add `gt rig repair <name>` that re-applies GT's schema requirements to a rig's beads DB without destroying data.
- **Manual workaround:** `bd config set types.custom "agent,role,rig,convoy,slot,queue,event,message,molecule,gate,merge-request"`

### BUG: `gt doctor` doesn't check per-rig beads types
- **Symptom:** `gt doctor --fix` reported `beads-custom-types ✓ All custom types registered` — but it was checking the town-level DB, not the broken rig's DB.
- **Fix:** The `beads-custom-types` check should iterate over every rig's database and verify custom types are registered in each one. `--fix` should be able to set `types.custom` on any rig that's missing it.

### TODO: Pre-flight validation in `gt sling`
- **Symptom:** When the `agent` type isn't registered, sling retries 10 times with exponential backoff (~3 minutes) before failing on a permanently broken config.
- **Fix:** Before attempting to spawn a polecat, verify the target rig's beads DB can create agent-type issues. Fail immediately with actionable guidance ("run `gt doctor --fix`" or "run `bd config set types.custom ...`") instead of retrying.

## P2 — Improvements

### TODO: Session rotation for long-running agents
- **Scope:** System agents that run for hours/days.
- **Approach:** `gt handoff` to fresh session periodically, preserving state via mail/hooks.
- **Note:** May not be needed if `/compact` works well enough.

### TODO: Simpler Witness loop for non-hook agents
- **Current:** Witness does full patrol (survey, mail, verify, refinery check) — lots of context.
- **Proposal:** For Kiro-based witnesses, run a minimal loop: check tmux alive, check bead status, restart dead things. Less LLM reasoning, less context growth.

## Resolved

### FIXED: Non-Claude agents get hardcoded Claude start command (commit `f106215d`)
- **Symptom:** Witnesses failed with `exit status 127: exec env -u CLAUDECODE NODE_OPTIONS='' claude --dangerously-skip-permissions` when default agent was Kiro.
- **Root cause:** TOML `start_command` guard in `witness/manager.go` and `daemon/lifecycle.go` used OR logic, causing non-Claude agents to use the hardcoded Claude command from built-in role TOMLs.
- **Fix:** Changed `||` to `&&` so the TOML path only fires when the agent is non-Claude AND the TOML has a custom (non-default) command. Default Claude TOML falls through to `BuildStartupCommandFromConfig` which respects the resolved agent preset.

### FIXED: Polecat session reuse skips cold-start injection (commit `1f719d72`)
- **Symptom:** `gt sling` reuses an idle polecat, starts a new kiro-cli session, but the session gets no work instructions.
- **Root cause:** Beacon/prompt injection only happened on fresh polecat spawn, not session reuse.
- **Fix:** `SpawnedPolecatInfo` now carries the issue (hooked bead ID) and passes it to `SessionStartOptions.Issue` for reused polecats.

### FIXED: Startup nudge not delivered to polecats (commits `cb58b57e`, `1f719d72`)
- **Symptom:** Polecat starts, sits at "How can I help?" — never receives work instructions.
- **Fix (first occurrence):** Merged work instructions into beacon CLI arg.
- **Fix (second occurrence):** Session reuse path now injects beacon same as fresh spawns.

### FIXED: Witness crashes from context accumulation
- **Symptom:** Witness runs patrol loops, tool outputs accumulate, Bedrock rejects with `ValidationException`.
- **Fix:** `CompactCommand`/`CompactThreshold` fields on `AgentPresetInfo`, `CompactIfNeeded()` in tmux package, wired into daemon heartbeat loop. Kiro preset: `/compact` at 50% context usage.

### FIXED: Auto-compact Kiro system agents
- Daemon heartbeat runs `compactSystemAgents()` which checks context usage for all long-running system agent sessions and triggers `/compact` when threshold exceeded.

### FIXED: macOS ASP kills gt binary after re-evaluation
- **Symptom:** `gt` commands randomly fail with SIGKILL. Kernel logs show `Security policy would not allow process: /opt/homebrew/bin/gt`.
- **Root cause:** `go build` produces an ad-hoc linker-signed binary. macOS ASP + corporate endpoint security re-evaluate and block weakly signed binaries.
- **Fix:** `scripts/install-local.sh` now runs `codesign --force --sign -` after every build+copy.

### FIXED: Kiro preset used --no-interactive (commit `3872018b`)
- Caused polecat sessions to exit immediately after completing prompt.
- Removed flag; Kiro now stays alive in tmux for follow-up work.

### FIXED: Kiro resume flag incompatible with Gas Town (commit `e5fabb8b`)
- Kiro's `--resume` takes no session ID. Moved to `ContinueFlag`, cleared `ResumeFlag`.
