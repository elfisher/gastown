# Gas Town Fork: "Bounded YOLO" Roadmap

## Philosophy

Let agents go full YOLO — but inside mathematically bounded safety nets. The system should be able to build itself: each goal makes the next goal faster and safer to build.

## Strategy

Fork [steveyegge/gastown](https://github.com/steveyegge/gastown). Gas Town already solves multi-agent orchestration, runtime management, worktree isolation, and work tracking. We add the brain: planning, knowledge, verification, and the bounded YOLO flywheel.

The system builds itself starting at Phase 1. Phase 0 is the only manual phase.

---

## Goal 1: The Agnostic Execution Engine (Including Kiro)

**Objective:** Add Kiro as a native runtime and validate the multi-runtime orchestration works.

**What Gas Town already has:** Pluggable runtime system (`internal/runtime/`), 10+ presets (Claude, Codex, Cursor, Gemini, AMP, etc.), per-task runtime override (`gt sling --agent`), custom runtime config (`gt config agent set`), tmux session management, git worktree hooks.

**What we add:**
- Kiro runtime preset: binary path, arg template (`--no-interactive`, `--trust-all-tools`, `--prompt`), prompt injection format
- Validate the full loop: Mayor creates convoy → slings bead to Kiro agent → agent works in hook → output captured

**Verification:** `gt config agent list` shows Kiro. `gt sling <bead> --agent kiro` spawns a Kiro process, agent receives prompt, produces output, exits cleanly. Manual smoke test.

**Priority:** P0 — everything else depends on a working fork with Kiro support.

---

## Goal 2: Verification-First Development Protocol (The Contract)

**Objective:** Ensure every unit of work has an explicit, machine-executable verification contract defined before execution begins. No code merges without a pre-agreed definition of done.

**Why second:** This is the "Bounded" in Bounded YOLO. Without it, every subsequent goal is just YOLO. The contract system gates everything the swarm produces from this point forward.

### Pre-Execution Contracts

Before any agent starts work, a HARNESS.md defines: what commands must pass, what behavioral assertions must hold, what edge cases must be covered, and what constitutes a regression.

### Verification Taxonomy

**Deterministic Verifiers** (binary pass/fail, no judgment)
- Compilation / build success
- Test suite pass/fail
- Linter / formatter compliance
- Type checker
- SAST/SCA scan results
- Benchmark regression (did latency/memory get worse?)

**LLM-as-Judge Verifiers** (subjective evaluation, scored)
- PRINCIPLES.md alignment — does the code reflect the project's values?
- Architectural coherence — does the change fit existing module boundaries?
- Code quality beyond lint — readability, abstraction level, PR-readiness
- Spec fidelity — does the implementation match PRD intent, not just acceptance criteria?
- Anti-goal violation — the spec says "don't build X." Did the agent build X anyway?

**Comparative Verifiers** (race mode, relative ranking)
- Diff size — smaller is usually better for the same outcome
- Complexity delta — cyclomatic complexity change vs. other candidates
- Test quality — not just "tests pass" but "are these good tests?" (LLM judge)
- Idiomatic fit — which solution looks more like the existing codebase?

**Human-in-the-Loop Verifiers** (escalation, not default)
- Ambiguous LLM judge results — if two judges disagree, escalate
- Novel architecture decisions — new patterns not in CONVENTIONS.md get human review
- Security-sensitive changes — auth/crypto/permissions always get human eyes

**Consensus Verifiers** (multiple judges, vote)
- Same LLM judge prompt against N models. Majority rules.
- Reuse the debate system (Goal 3's planner personas) for output review, not just spec review.

### Composable Contract Format

```yaml
tier0: [build, test]                           # deterministic, hard block
tier1: [feature_tests, lint]                   # deterministic, hard block
tier2: [principles_alignment, arch_coherence]  # LLM judge, score >= 7/10
tier3: [sast, benchmark]                       # deterministic, hard block
escalate: [security_review]                    # human, if files touch auth/*
compare: [diff_size, test_quality]             # race mode only
```

### Tiered Verification

- Tier 0: Build + existing tests pass (every task, no exceptions)
- Tier 1: Feature-specific tests exist and pass
- Tier 2: LLM judges score above threshold
- Tier 3: Security + performance checks
- Escalation: Human review for ambiguous or sensitive changes

### Contract Enforcement

The Witness (`internal/witness/`) runs the contract independently. The Mayor refuses to merge a hook unless all specified tiers pass. "The agent says it's done" is not a verification method.

### Contract Evolution

Contracts accumulate as the codebase grows. The test gap analyzer (Goal 5) identifies thin coverage. The knowledge pipeline (Goal 4) tracks verification maturity per module. The planner (Goal 3) uses this to set minimum tier requirements for changes to under-tested modules.

### Self-Bootstrapping

- Phase 0: Humans write contracts (we do this now)
- Phase 1+: `gt plan` generates contracts as part of the spec
- Phase 2+: Knowledge pipeline informs what contracts should cover

**Verification:** Define a contract for a simple task. Witness executes it. Deterministic checks produce pass/fail. LLM judge produces a score. Contract failure blocks merge. Contract pass allows merge.

**Priority:** P0 — this is the safety net that makes autonomous execution trustworthy.

---

## Goal 3: Interactive Spec Planning (The Agnostic Blueprint)

**Objective:** Bridge the gap between vague human intent and strict agent execution via a human-in-the-loop `gt plan` phase.

**What Gas Town already has:** The Mayor takes intent and creates convoys. But there's no structured planning conversation, no debate, no spec artifact, no execution gate.

**What we add:**

### The Clarification Loop
`gt plan "add feature X"` starts an interactive conversation. The Mayor acts as a PM, interrogating the request to clarify edge cases and define success criteria before any code is written.

### Structured Process
1. Braindump — user describes intent
2. Context sweep — system reads codebase (using MCP tools or file access), grounds the plan in reality
3. Draft + Debate — system drafts spec, runs it through reviewer personas (PM, Architect, Designer — customizable)
4. Iterate — incorporate feedback, loop until approved
5. Verification contract — generate HARNESS.md (ties directly to Goal 2)
6. Finalize — write PRD.md + HARNESS.md, lock the spec

### PRD.md + HARNESS.md Split
- PRD.md = the what (requirements, phases, anti-goals, blueprint)
- HARNESS.md = the how-to-verify (composable contract from Goal 2)

### The Execution Block
The orchestrator physically refuses to spawn worker agents until the human approves and locks the PRD. This is a hard gate, not a prompt.

### Agent-Agnostic Output
Specs are plain markdown. Verification commands are POSIX-standard (`make test`, `npm run test`). Any runtime can consume them.

**Verification:** `gt plan "add X"` produces a conversation. Conversation produces PRD.md + HARNESS.md. Attempting to execute without a locked spec fails. Locking the spec enables execution.

**Priority:** P1 — first thing the swarm builds (using Goal 2's contracts to verify its own output).

---

## Goal 4: First Principles & Dynamic Context Bootstrapping (The Map & The Law)

**Objective:** Automatically analyze a brownfield repository to establish its rules of engagement.

**What Gas Town already has:** Nothing. Gas Town assumes you know the repo.

**What we add:**

### Stack Inference (The Scout)
A "Scout" agent runs on first contact with a repo. Detects: language, package manager, frameworks, test runner, linter, CI system, directory conventions. Outputs structured `STACK.json`.

### First Principles Encoding
Extract or generate a PRINCIPLES.md — the project's constitution. Prioritizes project philosophy over AI impulses. LLM judges (Goal 2) calibrate against this document.

### Living State Context
Maintain synthesized, lightweight context files that update as the codebase evolves:
- `overview.md` — architecture and module map
- `modules/` — per-module details with AST-derived skeletons
- `ROUTING.md` — which module owns what
- `CONVENTIONS.md` — coding patterns
- `LEARNINGS.md` — lessons from past sessions

### Incremental Refresh
Before each execution phase, check if the codebase changed since last knowledge run. If so, trigger incremental pipeline (only re-process changed files).

**Verification:** Run scout on Gas Town itself → detects Go, identifies module structure, produces valid STACK.json. Run on a Node.js repo → detects Node. Knowledge pipeline output for the same input is deterministic (snapshot-testable).

**Priority:** P1 — agents without context produce garbage. This runs in parallel with Goal 3.

---

## Goal 5: Autonomous Verification Scaffolding (The Safety Net)

**Objective:** Retrofit robust testing and performance infrastructure into any project to act as the mathematical boundary for YOLO execution.

**What Gas Town already has:** The Witness reviews agent output. But it doesn't generate test infrastructure.

**What we add:**

### Zero-to-One CI/CD
Read STACK.json → generate standard pipeline files (GitHub Actions, GitLab CI). Template-based, deterministic — not LLM-generated.

### The "Test Gap" Retrofit
Use knowledge pipeline's module skeletons to identify untested business logic. Scaffold the right frameworks (Jest, PyTest, Go Test). Generate characterization (pinning) tests for existing behavior. Recommend property-based testing where appropriate.

### Continuous Benchmarking
Bootstrap performance profiling. Establish baselines for execution time, memory, binary size. Store in `BASELINE.json`. Benchmark regression becomes a Tier 3 verifier (Goal 2).

### Feedback Loop
Test gap analysis feeds into Goal 3's planner — "this module has 0% test coverage, so any changes here require Tier 1 verification at minimum." Contracts get stricter where coverage is thin.

**Verification:** Generate CI for Gas Town → valid YAML (`actionlint` passes). Test gap analyzer identifies modules with no tests (known to exist). Benchmark baseline captures real numbers.

**Priority:** P2 — depends on Goal 4 (STACK.json) for stack-aware generation.

---

## Goal 6: Dynamic DevSecOps Enforcement (The Vault)

**Objective:** Guarantee that AI agents cannot introduce security vulnerabilities or technical debt.

**What Gas Town already has:** The Witness role exists but doesn't run security tooling.

**What we add:**

### Context-Aware Scaffolding
Read STACK.json → inject correct SAST (Semgrep) and SCA (OSV-Scanner, npm audit, govulncheck) tools. Generate config files. This is deterministic, not LLM-driven.

### The Executioner (Enhanced Witness)
The Witness runs the security suite in complete isolation. On failure: rejects the PR, feeds the specific CWE/CVE failure log back to the agent, forces a secure rewrite. This plugs into Goal 2's Tier 3 verification.

### Security as a Verifier
Security checks are just another entry in the composable contract (Goal 2). They're not special — they're Tier 3 deterministic verifiers that happen to check for vulnerabilities instead of test failures.

**Verification:** Introduce a known vulnerability in a test file → Witness catches it. Clean code → Witness passes. CWE log is fed back to agent → agent produces fixed version.

**Priority:** P2 — depends on Goal 4 (STACK.json) and Goal 2 (contract enforcement).

---

## Goal 7: The "Bounded YOLO" Heterogeneous Swarm (The Flywheel)

**Objective:** Once specs and safety nets are locked, unleash maximum parallel AI concurrency.

**What Gas Town already has:** 20-30 agent parallelism, multi-runtime support, hooks for isolation, convoys for tracking, feed/health for monitoring, stuck agent detection.

**What we add:**

### Heterogeneous Swarms
Mayor assigns different runtimes to different tasks — or the same task to multiple runtimes. "Solve this with 2 Kiro instances and 2 Claude Code instances."

### Race Mode
Same bead → N agents in parallel, each in own hook with own runtime. First to pass the full verification contract (Goal 2) wins.

### The Meritocracy
Winner selection is deterministic + scored:
1. All Tier 0-1 checks pass (hard gate)
2. All Tier 3 checks pass (hard gate)
3. Tier 2 LLM judges score above threshold
4. Comparative verifiers break ties (diff size, test quality, idiomatic fit)
5. First agent to clear all gates wins — speed matters when quality is equal

The winner's hook gets merged. Losers get pruned.

### Strict Test-Driven Generation
Agents must write failing tests first, then implementation. The contract (Goal 2) enforces this by checking test file timestamps vs. source file timestamps, or by requiring a "red → green" commit sequence.

**Verification:** Race 2 agents on the same task. Both produce output. Meritocracy evaluator picks winner based on contract. Loser's hook is pruned. Winner merges. Edge cases: both fail (neither merges), both pass identically (first to finish wins), one passes tests but fails SAST (the other wins even if slower).

**Priority:** P3 — this is the capstone. Requires all other goals to be functional.

---

## Dependency Graph

```
Phase 0 (manual):
  G1 (Kiro Runtime) ──→ working fork
  G2 (Contracts)    ──→ safety net exists

Phase 1 (swarm-built, human-contracted):
  G3 (Planning)     ──→ specs for everything after
  G4 (Knowledge)    ──→ context for everything after

Phase 2 (swarm-built, plan-contracted):
  G5 (Verification Scaffolding) ──→ test infrastructure
  G6 (DevSecOps)                ──→ security infrastructure

Phase 3 (full bounded YOLO):
  G7 (Heterogeneous Swarm)      ──→ the flywheel
```

## The Self-Build Sequence

| Phase | What gets built | Who builds it | What verifies it |
|---|---|---|---|
| 0 | Fork + Kiro runtime + contract system | Human + Kiro (manual) | Human-written contracts |
| 1 | `gt plan` + knowledge pipeline | Gas Town swarm | Human-written contracts, Witness |
| 2 | CI gen + test gap + SAST | Gas Town swarm | `gt plan`-generated contracts, enhanced Witness |
| 3 | Race mode + meritocracy | Gas Town swarm | Full verification stack |

Each phase produces better tools for building the next phase.
