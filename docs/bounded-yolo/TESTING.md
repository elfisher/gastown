# Testing Practices

How we write and organize tests in this fork.

## Write the test first
- Negative tests prove the gap exists before you write the fix.
- When the fix lands, flip the assertion. The git history shows the transition.
- Every fix needs a guard test that asserts the fix doesn't break the happy path.

## Mock at the boundary
- Fake external commands (tmux, bd, gt) with shell scripts that return predictable output.
- Don't mock internal functions — mock what the code shells out to.
- Tests should be deterministic. No real tmux sessions, no real Dolt queries in unit tests.

## Test tiers
- Tier 0: Build + existing tests pass. Every commit, no exceptions.
- Tier 1: Feature-specific tests exist and pass.
- Tier 2: Integration tests that need Docker or live infrastructure.

## Naming
- Test names document intent: `TestCheckPolecatHealth_MissesValidationException` tells you what's tested and what's expected.
- Prefix negative tests with what they prove is missing. Prefix guard tests with what they protect.

## Scope
- Test one behavior per test. If a test needs a paragraph to explain, split it.
- Negative and guard tests live in the same file. They're two sides of the same fix.

---

# Verification Roadmap

Where we are and where we're headed. Each phase builds on the last.

## Phase 1: Provability and Foundation (Build Time)

What we have:
- Go compiler type checking
- golangci-lint in the repo

What we need:
- Formal verification of critical state machines (polecat lifecycle, bead state transitions). These are the "blast radius" components — invalid transitions cause silent failures.
- Strict enforcement of agent preset registry invariants at compile time. Adding a new agent should be a compile error if the registry entry is incomplete.

## Phase 2: Deterministic Behavior (CI)

What we have:
- Unit tests with shell script mocks (fake tmux/bd)
- Negative/positive test pairs that prove gaps before fixes
- Testcontainers for ephemeral Dolt databases

What we need:
- Property-based testing for state machines. Generate random transition sequences, assert no invalid states. Go has `testing/quick` and `gopter`.
- Fuzzing for pane parsers and string matching. `parseContextPercent`, pane pattern detection, and beads JSON parsing all operate on untrusted input. Go native fuzzing (`go test -fuzz`).
- Mutation testing to verify the test suite itself. If deliberately injected bugs don't fail CI, the tests are inadequate. Tools: `go-mutesting`.

## Phase 3: Systemic Assembly (Pre-Deployment)

What we have:
- Testcontainers for isolated Dolt per test run
- Isolated tmux sockets per test package

What we need:
- Contract testing between GT and beads. The split-brain initialization bug proves these two systems don't validate each other's assumptions. A CI test should spin up a fresh Dolt container and verify every rig's schema matches GT's expectations.
- Schema validation for inter-agent communication. Mail, nudge, and feed messages are untyped strings. Define schemas and validate at the boundary.

## Phase 4: Non-Deterministic & Semantic Evaluation

What we have:
- Nothing yet. This is Goal 2 (Verification Contracts) from the roadmap.

What we need:
- LLM-as-judge for agent output quality. When a polecat completes work, an evaluator scores it against the spec (HARNESS.md) on specific rubrics: "Does the code compile? Does it match the intent? Does it introduce regressions?"
- Multi-agent debate for complex evaluation. One agent generates, a red team agent critiques, a judge scores. This is the "comparative verifiers" concept from the roadmap.
- Golden dataset regression. A baseline set of known specs + expected outputs. Detect regressions in agent reasoning quality across system updates.
- PRINCIPLES.md alignment scoring. LLM judge evaluates whether agent output reflects project values (minimal changes, reliability over cleverness, etc.).

## Phase 5: Production Reality (Post-Deployment)

What we have:
- Daemon heartbeat with feed events, session death tracking, mass death detection
- Pane inspection for sick session detection
- GUPP violation checks for stalled agents

What we need:
- Structured telemetry export. The daemon has VictoriaMetrics fields but they may not be fully wired. Every health check result should be a metric.
- Alerting on invariant violations. The daemon logs but doesn't alert. "3 polecats died in 5 minutes" should page, not just log.
- Chaos engineering. Deliberate fault injection: kill Dolt mid-operation, drop tmux sessions during sling, throttle API responses. Verify the system degrades gracefully and the daemon recovers.

---

# Evaluations and Benchmarking

Not all verification is pass/fail. Some things need to be measured over time.

## When to benchmark
- Performance-sensitive paths: Dolt query latency, tmux capture-pane overhead, daemon heartbeat duration. If the heartbeat takes longer than its interval, the system falls behind.
- Resource consumption: context window usage per agent session, API credit burn rate per task, tmux session memory footprint over time.
- Recovery time: how long from "polecat dies" to "work is re-slung." This is the metric that matters for overnight autonomy.

## When to evaluate (not benchmark)
- Agent output quality: not measurable with a stopwatch. Requires LLM-as-judge or human review against rubrics.
- Planning quality: did the spec decomposition produce agent-sized pieces? Did the verification contract catch real issues? These are scored, not timed.
- System learning: are the same bugs recurring? Is the LEARNINGS.md actually reducing repeat failures? Track bug recurrence rate.

## Baselines
- Establish baselines before optimizing. Store in a `BASELINE.json` or equivalent.
- Benchmark regression is a Tier 2 verifier: "did this change make the heartbeat slower?"
- Evaluation regression is a Phase 4 verifier: "did this change make agent output worse?"

## What we probably don't need in GT
- Latency percentile tracking (p50/p99) — GT isn't a request-serving system. Heartbeat interval is the only timing that matters.
- Load testing — GT runs on one machine with a fixed number of agents. Concurrency is bounded by tmux sessions and API rate limits, not request volume.
- A/B testing — there's one user (the overseer). Evaluation is direct, not statistical.

The right level of benchmarking for GT is: "can the daemon keep up with its heartbeat interval while running all health checks, and does recovery happen within one heartbeat cycle?"
