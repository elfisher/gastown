# Verification Contracts — Design Doc

## Problem

Polecats declare victory without proof. `gt done` submits to the merge queue with no verification that the work actually satisfies the request. The refinery runs the rig's global test suite, but doesn't check bead-specific acceptance criteria. Result: broken code merges, duplicate exports ship, regressions land silently.

The dashboard V2 duplicate `AgentSchema` bug is the canonical example: two polecats both added the same schema, the refinery merged both, nobody ran `tsc --noEmit` on the combined result.

## Goal

Every bead has a machine-executable verification contract (harness) that must pass before the work is considered done. No code merges without a pre-agreed definition of done.

## Design

### The Harness

A harness is a list of commands attached to a bead. Each command is a verification step that must pass (exit 0) for the work to be accepted.

```yaml
# .gastown/harness/gt-abc.yaml
tier0:
  - make build
  - make test
tier1:
  - npm run lint
  - npx tsc --noEmit
verify:
  - "test -f dashboard-v2/src/pages/agents.ts"
  - "grep -q 'export function renderAgentDetail' dashboard-v2/src/pages/agents.ts"
```

- `tier0`: Build + existing tests. Hard block. Every bead, no exceptions.
- `tier1`: Quality gates (lint, typecheck). Hard block.
- `verify`: Bead-specific assertions. "Did the agent do what was asked?" Hard block.

Tiers run in order. If tier0 fails, tier1 and verify don't run.

### Storage

Option A: Field on the bead itself. `bd update gt-abc --harness=".gastown/harness/gt-abc.yaml"`. Simple, portable, visible in `bd show`.

Option B: Convention-based file path. `.gastown/harness/<bead-id>.yaml` auto-discovered. No bead field needed. Harness lives in the repo, version-controlled with the code.

Option C: Both. Field points to file. Default to convention path if field is empty.

Recommendation: Option C. The field is the source of truth, convention path is the fallback.

### Enforcement Points

**1. `gt done` (polecat self-check)**

Before submitting to the merge queue, `gt done` runs the harness in the polecat's worktree. If any tier fails, the bead stays hooked and the polecat sees the failure output. The polecat must fix the issue and run `gt done` again.

This is the primary gate. It catches most issues at the source — the agent that wrote the code is the first to verify it.

**2. Refinery (post-rebase check)**

After rebasing the polecat's branch onto the target, the refinery runs the harness again. This catches integration issues: code that passes in isolation but breaks after rebase (the duplicate schema bug).

The refinery already runs test commands from the rig config. The harness adds bead-specific commands on top. Order: rig tests first (global), then harness (bead-specific).

**3. Daemon heartbeat (post-merge audit)**

After the refinery pushes, the daemon can optionally run tier0 on the merged branch as a smoke test. This is belt-and-suspenders — it catches cases where the refinery's session died between test and push, or where the push included untested changes.

This is lower priority. Points 1 and 2 catch most issues.

### Rig-Level Defaults

Not every bead needs a custom harness. Rigs should have default verification commands that apply to all beads:

```json
// gastown/config.json
{
  "base_branch": "dashboard-v2",
  "harness_defaults": {
    "tier0": ["go build ./...", "go test ./..."],
    "tier1": ["golangci-lint run"]
  }
}
```

For the dashboard-v2 work specifically:
```json
{
  "harness_defaults": {
    "tier0": ["cd dashboard-v2 && npm run build", "cd dashboard-v2 && npm test"],
    "tier1": ["cd dashboard-v2 && npx tsc --noEmit"]
  }
}
```

Bead-specific harnesses extend (not replace) the rig defaults. The `verify` tier is always bead-specific.

### Harness Generation

Phase 0 (now): Humans write harnesses. The Mayor or overseer attaches a harness when creating beads.

Phase 1 (Goal 3): `gt plan` generates harnesses as part of the spec. The planner knows the codebase (via Goal 4 knowledge pipeline) and can generate appropriate tier0/tier1 commands and bead-specific verify assertions.

Phase 2+: The system learns which verification commands catch real bugs and adjusts. Harnesses that never fail get pruned. Harnesses that catch regressions get promoted to rig defaults.

### What This Prevents

| Failure mode | Caught by |
|---|---|
| Duplicate exports (schema merge conflict) | tier1: `tsc --noEmit` at `gt done` |
| Tests broken after rebase | tier0 at refinery |
| Agent didn't implement the feature | verify assertions at `gt done` |
| Lint violations | tier1 at `gt done` |
| Build broken | tier0 at `gt done` |
| Code merged but doesn't work | tier0 at daemon post-merge audit |

### Implementation Order

1. Add `harness` field to beads (or convention path discovery)
2. `gt done` reads and runs the harness before submitting
3. Rig-level `harness_defaults` in config.json
4. Refinery runs harness after rebase
5. `gt plan` generates harnesses (Goal 3)
6. Daemon post-merge audit (optional, belt-and-suspenders)

Steps 1-3 are the minimum viable verification system. A polecat could implement this.

### Non-Goals (for now)

- LLM-as-judge scoring (Goal 2 Phase 4 — needs the contract system first)
- Multi-agent debate / red team review (Goal 7)
- Benchmark regression detection (needs baselines)
- Property-based testing / fuzzing (Phase 2 of TESTING.md — orthogonal to contracts)

These are all in the roadmap but depend on the basic harness system existing first.
