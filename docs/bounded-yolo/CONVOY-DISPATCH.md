# Convoy Auto-Dispatch Design

## Vision

One spec → one convoy → multiple beads with dependency ordering → auto-dispatch → cross-bead verification on completion.

The convoy is the execution engine for a spec. The human (or `gt plan`) creates the spec, it becomes a convoy with beads, and the system runs it to completion autonomously.

## Current Gaps

### Bug: Tracking relationships not created
`gt convoy create --owned` with multiple issues shows 0/0 progress. The `tracks` dependencies aren't being created in beads — issues are listed in the description but not wired as deps. Nothing else works until this is fixed.

### Missing: Human slings → owned convoys by default
When a human slings work, the convoy should be owned (auto-continue). Check `BD_ACTOR` — if empty or "overseer", owned. If agent role, unowned. One-line change.

### Missing: Convoy continuation after bead completion
After a polecat finishes and the bead closes, nobody checks "was this part of an owned convoy? What's next?" The witness retires the polecat and moves on. The Mayor fills this gap by polling, but that's expensive and non-deterministic.

Fix: deterministic logic in the daemon heartbeat. After a bead closes, check if it belongs to an owned convoy. If yes, find the next unblocked bead and sling it. Same pattern as all our other daemon fixes — the daemon is the safety net.

### Missing: Convoy management CLI
- `gt convoy set <id> --owned` — flip owned on existing convoys
- `gt sling <bead> <rig> --convoy <id>` — add to existing convoy instead of creating new one

### Missing: Cross-bead verification
When all beads in a convoy are done, run the convoy's harness (integration check) on the merged result before closing. Ties into the verification contracts design.

## Implementation Order

1. **Fix tracking relationships** (P0 bug) — blocker for everything else
2. **Human slings → owned** (P1) — one-line change, fixes the default behavior
3. **Daemon convoy continuation** (P1) — the auto-dispatch loop, replaces Mayor polling
4. **CLI improvements** (P2) — `--owned`, `--convoy` flags
5. **Cross-bead verification** (P2) — ties into verification contracts

Steps 1-3 together give you: sling a batch of work → owned convoy → polecats work in parallel → as each finishes, daemon auto-dispatches next → convoy closes when all done.

## How It Connects

- **Verification Contracts** (VERIFICATION-CONTRACTS.md): the convoy is where cross-bead verification lives. Per-bead harnesses run at `gt done`. The convoy harness runs when all beads complete.
- **Working Branch** (base_branch): the convoy's beads all target the same working branch. The refinery merges each bead's work there.
- **Daemon heartbeat**: convoy continuation is another check in the heartbeat loop, same as pane inspection, push consistency, etc.
