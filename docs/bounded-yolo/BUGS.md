# Bugs & TODOs — Kiro Integration

## P0 — Blocking Overnight Autonomy

### BUG: Polecat session reuse skips cold-start injection
- **Symptom:** `gt sling` reuses an idle polecat, starts a new kiro-cli session, but the session gets no work instructions. Agent shows "How can I help?" with work on its hook.
- **Root cause:** The beacon/prompt injection only happens on fresh polecat spawn. When an existing idle polecat gets new work slung to it, the session startup path doesn't re-inject the beacon with hook context.
- **Impact:** Polecat sits idle. Requires manual intervention. Blocks overnight autonomy.
- **Fix needed:** The session reuse path (sling to existing polecat) must inject the beacon the same way fresh spawns do — either as a CLI arg when starting the new kiro-cli process, or as a reliable nudge after startup.

### BUG: Witness crashes from context accumulation
- **Symptom:** Witness runs patrol loops, tool outputs accumulate, Bedrock rejects with `ValidationException: Improperly formed request`, session drops to dead prompt.
- **Impact:** Polecat completions never get processed, beads stay HOOKED, pipeline stalls.
- **Fix:** Trigger `/compact` via tmux nudge when Kiro context usage exceeds threshold (parse `%` from prompt line). Run after every N patrol cycles or at ~50% context.

### BUG: Startup nudge not delivered to polecats (PARTIALLY FIXED)
- **Symptom:** Polecat starts, sits at "How can I help?" — never receives work instructions.
- **Root cause (first occurrence):** Gas Town sent work instructions as delayed tmux nudge, but Kiro's TUI wasn't ready.
- **Fix applied:** Merged work instructions into beacon CLI arg (commit `cb58b57e`).
- **Root cause (second occurrence):** When `gt sling` reuses an idle polecat and starts a new kiro-cli session, the cold-start hook injection doesn't fire. The hook is correctly attached (bead is HOOKED) but the new session launches with default prompt, not the beacon. The fix only works for fresh polecat spawns, not session reuse.
- **Impact:** Polecat sits idle with work on its hook. Requires manual `tmux send-keys` to kick it.
- **Fix needed:** Session reuse path must inject the beacon/hook context the same way fresh spawns do.

### TODO: Deacon should auto-restart crashed Witness
- **Symptom:** Witness dies, Deacon doesn't restart it fast enough (or at all).
- **Impact:** Same as Witness crash — everything stalls.
- **Fix:** Deacon heartbeat should detect dead Witness tmux session and restart immediately.
- **Spec:**
  - Detect idle state: capture pane, look for idle `!>` prompt with no recent activity for N minutes (not instant — avoid false positives during thinking pauses)
  - Max restart count: 3 restarts per 10-minute window, then stop and escalate to human
  - System agents only: auto-restart Witness, Refinery, Deacon. Polecats get flagged, not auto-restarted (risk of losing uncommitted work)
  - Don't restart if actively working: check for `⠋ Thinking...` or tool execution output before killing
  - Race condition guard: don't restart while agent is processing `gt done` or merge queue operations

### TODO: Auto-compact Kiro system agents to prevent context overflow
- **Trigger:** When Kiro context usage exceeds configurable threshold (default 50%)
- **Method:** Nudge `/compact Retain: role, current patrol state, active polecats and their beads. Discard: tool output details, old patrol results.` via tmux send-keys
- **Scope:** Witness, Refinery, Deacon, Mayor
- **Config:** Threshold percentage should be configurable in Kiro preset (default 50%)
- **Parsing:** Read context `%` from Kiro prompt line (e.g., `8% !>`) via tmux capture-pane
- **Frequency:** Check after every patrol cycle or every N minutes

## P0 — Merge Pipeline Data Loss

### BUG: Refinery merge-push is not atomic — silent code loss
- **Symptom:** Four polecats finished dashboard phases, submitted to merge queue. Refinery rebased all 4 MRs successfully, but the final `git push` never executed (session got stuck in vim from nudge event spam). MRs were marked as processed, beads were closed, but code only existed on a local detached commit. Overnight, polecats respawned to redo already-completed work.
- **Root cause:** The refinery marks MRs as processed before the push succeeds. If anything fails after that point (session dies, vim trap, restart), the MR is consumed but code never lands on any remote branch. No rollback, no retry.
- **Impact:** Silent data loss. The system reports success while code is lost. Polecats redo work, creating duplicates and wasting cycles. This is the most dangerous bug class — invisible failure.
- **Fix:** Don't mark an MR as processed until the push succeeds. If the push fails, leave the MR in the queue with a "push-pending" status so the next patrol retries it. On session restart, the refinery should check for locally-merged-but-not-pushed commits and push them before processing new MRs.

### BUG: Polecats and refinery default to main instead of working branch
- **Symptom:** All polecats branched from and merged into `main`. The dashboard work should have targeted `dashboard-v2`. Had to manually force-push merged commits to the correct branch after the fact.
- **Root cause:** GT defaults everything to the rig's `default_branch` (main). There's no concept of a working branch. The `--base-branch` flag exists per-sling but: (a) nobody remembers to pass it every time, (b) the merge queue records `main` as the target regardless, (c) the refinery reads the target from the MR, so it pushes to `main` no matter what.
- **Impact:** Code lands on the wrong branch. For fork workflows, pushing to `main` is wrong — `main` should stay synced with upstream. All work should go to the feature/working branch.
- **Fix:** Add a `base_branch` field to the rig's `config.json`. When set:
  - Polecats branch from `base_branch` by default (not `default_branch`)
  - MRs record `base_branch` as the target
  - Refinery pushes to `origin/<base_branch>`
  - `gt sling` reads this automatically — no `--base-branch` needed
  - Falls back to `default_branch` if `base_branch` is not set
  - The working branch is the default, not the exception

### BUG: Nudge event spam corrupts refinery session
- **Symptom:** During merge processing, the refinery's tmux pane got flooded with repeated GE_READY nudge events. This corrupted its output and caused it to land in a vim session (git merge commit editor), stalling the merge pipeline.
- **Root cause:** Multiple polecats finishing near-simultaneously each trigger GE_READY events. No deduplication or throttling.
- **Fix:** Deduplicate or throttle nudge events. Multiple identical events within a short window should be collapsed into one. The nudge queue already exists — add a "last event type + timestamp" check before enqueuing.

### TODO: Post-merge consistency check (daemon safety net)
- **Symptom:** Beads marked as closed but target branch doesn't contain the expected commits. System believes work is done when it isn't.
- **Fix:** Daemon heartbeat check: for recently-closed beads, verify the target branch actually contains the merge commit. If not, flag as inconsistency and either retry the push or alert the overseer. Same pattern as pane inspection — the daemon is the safety net.

## P1 — Reliability

### TODO: Mayor shouldn't poll in a while loop
- **Symptom:** Mayor burns an Opus-tier LLM session sitting in `while true; sleep 30; bd show` loop.
- **Impact:** Expensive, wasteful, holds context open.
- **Fix:** Convoy system should auto-advance when polecats complete. Mayor dispatches upfront, doesn't babysit.

### TODO: 6 zombie tmux sessions from failed attempts
- **Symptom:** Dashboard shows "6 dead" badge.
- **Impact:** Cosmetic, but confusing.
- **Fix:** `gt cleanup` or `gt shutdown && gt up` clears them. Consider auto-pruning on startup.

### TODO: Validate startup fix actually works
- **Status:** Code merged but not yet tested end-to-end.
- **Test:** Sling a bead, wait 30s, check if polecat is working (not stuck at prompt).

## P2 — Improvements

### TODO: Auto-compact for all Kiro system agents
- **Scope:** Witness, Refinery, Deacon, Mayor.
- **Approach:** After every patrol cycle (or every N minutes), nudge with `/compact Retain: role, active state. Discard: old tool outputs.`
- **Alternative:** Parse context `%` from tmux pane, compact when >50%.

### TODO: Session rotation for long-running agents
- **Scope:** System agents that run for hours/days.
- **Approach:** `gt handoff` to fresh session periodically, preserving state via mail/hooks.
- **Note:** May not be needed if `/compact` works well enough.

### TODO: Simpler Witness loop for non-hook agents
- **Current:** Witness does full patrol (survey, mail, verify, refinery check) — lots of context.
- **Proposal:** For Kiro-based witnesses, run a minimal loop: check tmux alive, check bead status, restart dead things. Less LLM reasoning, less context growth.

## Resolved

### FIXED: macOS ASP kills gt binary after re-evaluation
- **Symptom:** `gt` commands randomly fail with SIGKILL. Kernel logs show `Security policy would not allow process: /opt/homebrew/bin/gt`.
- **Root cause:** `go build` produces an ad-hoc linker-signed binary. macOS ASP + corporate endpoint security (Ava/FortiDLP) periodically re-evaluate and block weakly signed binaries, especially under rapid invocation by agents.
- **Fix:** `scripts/install-local.sh` now runs `codesign --force --sign -` after every build+copy. Must always use the install script, never raw `cp`.
- **Permanent fix:** Use `make build` for proper signing, or add codesign to the Makefile.

### FIXED: Kiro preset used --no-interactive (commit `3872018b`)
- Caused polecat sessions to exit immediately after completing prompt.
- Removed flag; Kiro now stays alive in tmux for follow-up work.

### FIXED: Kiro resume flag incompatible with Gas Town (commit `e5fabb8b`)
- Kiro's `--resume` takes no session ID. Moved to `ContinueFlag`, cleared `ResumeFlag`.
