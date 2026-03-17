# Bugs & TODOs — Kiro Integration

## Test Plan: Negative Tests for Daemon Health Gaps

Write all tests first (red), then implement fixes (green). Tests use the existing mock pattern from `polecat_health_test.go`: fake tmux/bd shell scripts, construct a `Daemon` struct, assert on log output.

### Mock infrastructure needed

- `writeFakeTestTmuxAlive(t, dir, paneContent)` — returns success for `has-session`, returns `paneContent` for `capture-pane`
- Reuse existing `writeFakeTestBD` for bead state

### Tier 1: Specific pane pattern detection

These test that the daemon detects known failure patterns in alive sessions.

**Test 1: `TestCheckPolecatHealth_MissesValidationException`** (negative)
- Setup: tmux session alive, pane contains `ValidationException: Improperly formed request`, polecat has hooked bead, agent_state=working
- Current behavior: no detection (session alive → "nothing to do")
- Assert: no `SICK_SESSION` logged, no `CRASH DETECTED` logged
- After fix: assert `SICK_SESSION` logged, kill + re-sling triggered

**Test 2: `TestCheckPolecatHealth_MissesModelSelectionPrompt`** (negative)
- Setup: tmux session alive, pane contains `Select model (type to search):`, polecat has hooked bead
- Current behavior: no detection
- Assert: no `SICK_SESSION` logged, no tmux send-keys invoked
- After fix: assert `MODEL_PROMPT_DETECTED` logged, Enter sent via tmux send-keys

**Test 3: `TestCheckPolecatHealth_IgnoresSickPaneWhenWorking`** (positive guard)
- Setup: tmux session alive, pane contains `⠋ Thinking...`, polecat has hooked bead
- Assert: no detection, no action (even if pane also contains stale error text from scrollback)
- This test should pass both before and after the fix — it guards against false positives

### Tier 2: Generic staleness detection

These test that the daemon detects sessions with no pane changes across heartbeats.

**Test 4: `TestCheckPolecatHealth_MissesStaleSession`** (negative)
- Setup: tmux session alive, pane content identical across two calls to `checkPolecatHealth`, polecat has hooked bead, agent_state=working
- Current behavior: no detection
- Assert: no `STALE_SESSION` logged
- After fix: assert `STALE_SESSION` logged on second check, nudge sent. Assert kill on third check if still stale.

**Test 5: `TestCheckPolecatHealth_StaleSessionWithNoHook`** (positive guard)
- Setup: tmux session alive, pane unchanged, but polecat has NO hooked bead (idle)
- Assert: no detection, no action — idle agents are allowed to be stale
- Should pass before and after fix

### Pre-sling rig validation

**Test 6: `TestSlingPreflight_MissingCustomTypes`** (negative)
- Setup: rig beads DB exists but has no `agent` custom type registered
- Current behavior: sling proceeds, retries 10 times, fails
- Assert: no pre-flight error (function doesn't exist yet)
- After fix: assert `validateRigReady()` returns error with actionable message

**Test 7: `TestSlingPreflight_ValidRig`** (positive guard)
- Setup: rig beads DB has all custom types registered
- Assert: `validateRigReady()` returns nil
- Should pass after fix is implemented

**Test 8: `TestDoctorCheck_PerRigTypes`** (negative)
- Setup: town-level DB has custom types, one rig DB is missing them
- Current behavior: doctor reports all clear (only checks town-level)
- Assert: doctor check passes (proving the gap)
- After fix: assert doctor check fails for the broken rig

### Boot race condition

**Test 9: `TestHeartbeat_DetectsRetirementLimbo`** (negative)
- Setup: polecat agent_state=waiting-for-retirement, merge request in queue, refinery session alive, witness session alive but sleeping (pane unchanged)
- Current behavior: no detection
- Assert: no nudge sent to witness
- After fix: assert witness nudged via tmux send-keys

### Reboot recovery

**Test 10: `TestHeartbeat_DetectsOrphanedHookedPolecats`** (negative)
- Setup: polecat has hooked bead in DB, no tmux session exists, agent_state=working (not spawning)
- Current behavior: `checkPolecatSessionHealth` detects this and notifies witness — but does NOT auto-respawn
- Assert: `CRASH DETECTED` logged but no new tmux session created
- After fix: assert auto-respawn triggered (or re-sling dispatched)

## Architecture Note: Why Existing Daemon Checks Don't Catch Our Bugs

### Test Plan: Merge Pipeline (P0)

**Test 11: `TestRefinery_MRMarkedBeforePush`** (negative)
- Setup: mock refinery ProcessResult where push fails after MR is marked processed
- Current behavior: MR is consumed, code never pushed, no retry
- Assert: MR status is "processed" even though push failed (proving the gap)
- After fix: assert MR stays in queue with "push-pending" status when push fails

**Test 12: `TestSling_DefaultsToMainNotWorkingBranch`** (negative)
- Setup: rig config has `default_branch: "main"`, no `base_branch` set
- Current behavior: sling targets main
- Assert: resolved target branch is "main" (proving the gap)
- After fix: assert sling reads `base_branch` from rig config when set

**Test 13: `TestSling_RespectsBaseBranch`** (positive)
- Setup: rig config has `base_branch: "dashboard-v2"`
- Assert: resolved target branch is "dashboard-v2"
- Guard test — should pass after fix

**Test 14: `TestNudgeQueue_DuplicateEventsNotThrottled`** (negative)
- Setup: enqueue 5 identical GE_READY events within 1 second
- Current behavior: all 5 are enqueued
- Assert: queue length is 5 (proving no deduplication)
- After fix: assert queue length is 1 (duplicates collapsed)

**Test 15: `TestDaemon_PostMergeConsistencyCheck`** (negative)
- Setup: bead marked closed with merge_commit set, but target branch doesn't contain that commit
- Current behavior: no detection
- Assert: no inconsistency flagged
- After fix: assert MERGE_INCONSISTENCY logged

## Architecture Note: Why Existing Daemon Checks Don't Catch Our Bugs

The daemon heartbeat already has sophisticated health checking. Here's what it does and where the gaps are:

### What the daemon already checks (every 3 minutes)

| Step | What it does | What it catches |
|------|-------------|-----------------|
| 0 | Sleep/wake detection | Nudges stalled polecats after laptop sleep (two-phase: nudge → kill) |
| 1-6 | `ensureXRunning()` for all system agents | Dead tmux session → respawn (Deacon, Witnesses, Refineries, Mayor) |
| 10 | GUPP violation check | Polecats with work-on-hook not progressing |
| 11 | Orphaned work check | Work assigned to dead agents |
| 12 | `checkPolecatSessionHealth()` | Polecat has hooked bead but tmux session is dead → notify Witness |
| 12b | Reap idle polecats | Kill sessions idle too long (API slot burn) |
| 12c | `compactSystemAgents()` | Auto-compact system agents when context > threshold |

### The critical gap: "session alive but agent dead"

Step 12 (`checkPolecatSessionHealth`) only checks **whether the tmux session exists**. If the session exists, it returns immediately — "Session is alive, nothing to do." It never looks inside the session.

This means the daemon is blind to:

- **Context blowup** — tmux session is alive, but the agent hit `ValidationException` and is sitting at a dead prompt. Session exists → daemon says "all good."
- **Model unavailability** — tmux session is alive, but the agent is stuck at an interactive model selection prompt. Session exists → daemon says "all good."
- **Idle reuse failure** — polecat has a hooked bead and a tmux session, but the session never received work instructions. Session exists → daemon says "all good."

The daemon checks for **session death** but not **session sickness**. A sick session (alive but non-functional) is invisible to every current check.

### The fix: add pane content inspection to step 12

The building blocks already exist:
- `tmux capture-pane` is already used by `compactSystemAgents()` to read context percentage from the prompt
- The two-phase nudge/kill pattern from sleep/wake recovery (`postWakeStalled`) is proven
- `notifyWitnessOfCrashedPolecat()` already handles the recovery dispatch

What's missing is a `checkPolecatSessionSickness()` step that, for sessions that ARE alive, captures the pane and looks for:
1. API error strings (`ValidationException`, `Improperly formed request`)
2. Interactive prompts the agent can't answer (model selection, confirmation dialogs)
3. Idle prompt with no activity for N minutes while work is hooked

Any of these → same two-phase treatment: nudge first, kill and re-sling on next heartbeat if still sick.

### The split-brain gap: no pre-flight validation

Separately, the daemon has no pre-flight checks before work is dispatched. `gt sling` doesn't validate that the target rig's beads DB has the right custom types, redirects, or routing. The daemon's `checkPolecatSessionHealth` catches the crash AFTER it happens, but the crash-loop continues because the root cause (broken config) persists across re-slings.

The fix: add a `validateRigReady()` check that `gt sling` calls before spawning, and that `gt doctor` runs per-rig instead of town-level only. This turns a 10-retry crash loop into a fast failure with actionable guidance.

### Summary: two additions to the heartbeat

1. **Pane inspection for sick sessions** — extend step 12 to look inside alive-but-broken sessions. Uses existing `capture-pane` and two-phase nudge/kill patterns.
2. **Pre-sling rig validation** — not in the heartbeat itself, but called by `gt sling` and `gt doctor` to prevent dispatching work to broken rigs.

These two changes cover all 12 open bugs through the same mechanisms GT already uses.

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

### BUG: GT/beads split-brain initialization
- **Symptom:** Running `bd init --force` directly creates a valid beads database but one missing everything GT layered on top — custom issue types, polecat worktree redirects, routing config, metadata. GT assumes those exist and doesn't validate before spawning work. Polecats spawn, sessions crash, daemon logs the crash every heartbeat, nothing self-heals.
- **Root cause:** GT and beads have separate initialization models. GT manages rigs and knows about custom types/redirects/routing. Beads manages its own database with its own init. Neither validates the other's assumptions.
- **Impact:** Silent failures. The config gap isn't caught by any existing doctor check at the right level.
- **Fix options (pick one):**
  - (a) Make `bd init` GT-aware: when running inside a GT town, automatically inherit GT's requirements (custom types, redirects, routing)
  - (b) GT owns rig init end-to-end: block or wrap `bd init --force` so it can't create a half-configured database. Add `gt rig repair <name>` that re-applies the full GT schema
  - (c) GT validates the full beads config chain (types, redirects, routing) before every sling and fails fast with a repair command if anything is missing
- **Related:** "BUG: `bd init --force` inside a GT town creates vanilla beads DB" and "BUG: `gt doctor` doesn't check per-rig beads types" are symptoms of this same root cause

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

### BUG: Polecat context blowup kills session with no recovery
- **Symptom:** Polecat ingests a large spec + multiple tool outputs, context grows until API rejects with `ValidationException: Improperly formed request`. Session drops to dead prompt, polecat stalls silently.
- **Root cause:** Context grows monotonically within a single task. Unlike system agents (protected by auto-compact), polecats have no safety net. When the API limit is hit, the session is unrecoverable.
- **Impact:** Work stalls silently until a human notices.
- **Fix:** Detect dead polecat sessions (no activity, API error in pane output, dead prompt), mark the bead as failed, and re-sling to a fresh polecat. The Witness or daemon should handle this as part of its patrol — same pattern as stuck agent detection but checking for API errors specifically.

### BUG: Model unavailability drops polecat into interactive prompt
- **Symptom:** When the selected model becomes temporarily unavailable mid-session, the agent drops into an interactive model selection prompt. Autonomous polecats can't answer interactive prompts, so they get stuck indefinitely.
- **Impact:** Polecat hangs forever. Work stalls. No automatic recovery.
- **Fix options:**
  - Pre-configure a fallback model so the agent auto-switches without prompting
  - Detect the stuck model-selection prompt via tmux capture-pane and auto-select (similar to how sleep/wake nudging works)
  - Pass a flag or env var that tells the agent runtime to never prompt interactively for model selection

### BUG: Rig boot race condition — witness sleeps before refinery is ready
- **Symptom:** Polecat finishes work quickly, submits to merge queue, enters "waiting for retirement." Witness patrols, sees refinery not yet running, concludes "rig is idle," goes to sleep. Refinery boots shortly after but witness is asleep. Nobody processes the MR or retires the polecat. Work stalls indefinitely.
- **Root cause:** Witness patrol is a point-in-time snapshot with no retry. If the refinery isn't up when the witness patrols, it moves on. The stop hook that wakes the witness only fires on new external activity — a refinery coming online doesn't trigger it.
- **Compounding factor:** Kiro CLI nudge falls back to queue mode (no prompt detection). Queued nudges only deliver when the stop hook fires, but a sleeping agent never finishes a turn, so nudges never arrive. Had to bypass nudge system and send keys directly to tmux pane.
- **Impact:** Polecat sits idle saying "waiting for retirement..." indefinitely. MR sits unprocessed.
- **Fix:** This is another case for the daemon heartbeat safety net. The daemon already checks polecat session health every 3 minutes. Add detection for: "polecat waiting for retirement + MR in queue + refinery alive for >N minutes" → auto-nudge the witness via direct tmux send-keys (bypassing the broken queue-mode nudge path).
- **Additional fixes:**
  - Witness should schedule a follow-up patrol if it sees "refinery down" instead of going to sleep
  - Refinery should self-check the merge queue on boot instead of waiting for the witness
  - Consider boot sequencing: start polecats only after witness and refinery are confirmed running, or have the witness do a second patrol N seconds after boot

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
