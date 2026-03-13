# Bugs & TODOs — Kiro Integration

## P0 — Blocking Overnight Autonomy

### BUG: Witness crashes from context accumulation
- **Symptom:** Witness runs patrol loops, tool outputs accumulate, Bedrock rejects with `ValidationException: Improperly formed request`, session drops to dead prompt.
- **Impact:** Polecat completions never get processed, beads stay HOOKED, pipeline stalls.
- **Fix:** Trigger `/compact` via tmux nudge when Kiro context usage exceeds threshold (parse `%` from prompt line). Run after every N patrol cycles or at ~50% context.

### BUG: Startup nudge not delivered to polecats (FIXED)
- **Symptom:** Polecat starts, sits at "How can I help?" — never receives work instructions.
- **Root cause:** Gas Town sent work instructions as delayed tmux nudge, but Kiro's TUI wasn't ready.
- **Fix:** Merged work instructions into beacon CLI arg (commit `cb58b57e`). Needs validation that it actually works now.

### TODO: Deacon should auto-restart crashed Witness
- **Symptom:** Witness dies, Deacon doesn't restart it fast enough (or at all).
- **Impact:** Same as Witness crash — everything stalls.
- **Fix:** Deacon heartbeat should detect dead Witness tmux session and restart immediately.

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

### FIXED: Kiro preset used --no-interactive (commit `3872018b`)
- Caused polecat sessions to exit immediately after completing prompt.
- Removed flag; Kiro now stays alive in tmux for follow-up work.

### FIXED: Kiro resume flag incompatible with Gas Town (commit `e5fabb8b`)
- Kiro's `--resume` takes no session ID. Moved to `ContinueFlag`, cleared `ResumeFlag`.
