# Gas Town Fork: Implementation Plan

## Current State Assessment

kiro-swarm already has significant infrastructure we can build on:
- Orchestrator loop (init → plan → execute → verify → complete)
- Git worktree isolation per session
- Agent spawning via `kiro-cli` child process
- Bedrock-based LLM for planning/verification
- Interactive planner with debate/review
- Knowledge pipeline (skeleton → summarize → synthesize)
- Task verification with retry loop
- MCP tool integration

## What's Missing vs. the Roadmap

| Roadmap Goal | Current State | Gap |
|---|---|---|
| G1: Agnostic runtimes | Hardcoded to `kiro-cli` in spawner.js | Need pluggable runtime configs |
| G2: Spec planning | Interactive planner exists, no PRD lock gate | Need execution block + PRD/HARNESS.md output |
| G3: First principles | PRINCIPLES.md + knowledge pipeline exist | Need stack inference scout + living context refresh |
| G4: Verification scaffolding | Task verifier exists, no CI/CD gen | Need CI gen, test gap analysis, benchmarking |
| G5: DevSecOps | Nothing | Need SAST/SCA injection, Witness role |
| G6: Heterogeneous swarm | Single-tool parallel execution exists | Need multi-tool swarm, meritocracy merge |

---

## Phase 1: Pluggable Runtime Engine (Goal 1)

**Why first:** Everything else depends on being able to spawn different tools.

### 1.1 Runtime config schema
- Create `src/runtimes/` module
- Define `runtime-config.json` schema: `{ name, binary, args_template, prompt_injection, env, timeout }`
- Ship presets: `kiro.json`, `aider.json`, `claude-code.json`

### 1.2 Universal context injection
- Create `src/runtimes/translator.js`
- Takes a Bead (task) → returns `{ command, args, stdin, env }` per runtime
- Kiro: `--prompt` flag, Aider: `--message`, Claude Code: stdin pipe

### 1.3 Refactor spawner.js
- Replace hardcoded `kiro-cli` with runtime-resolved command
- `spawnAgent(runtimeName, options)` reads from runtime config
- Keep existing tmux/worktree isolation

### Test: Spawn a mock "echo" runtime, verify it receives the translated prompt.

---

## Phase 2: Execution Gate & PRD Lock (Goal 2)

**Why second:** Prevents premature execution before specs are approved.

### 2.1 PRD output format
- Modify `InteractivePlanner._writeSpec()` to output `PRD.md` + `HARNESS.md`
- PRD.md = requirements, HARNESS.md = verification contract

### 2.2 Execution block
- Add `locked: boolean` field to session state
- `coordinateTasks()` checks `state.locked === true` before spawning
- `gt plan --approve` sets `locked = true`

### Test: Attempt to run `execute` on unlocked session → expect rejection.

---

## Phase 3: Scout Agent & Stack Inference (Goal 3)

**Why third:** Context quality determines agent output quality.

### 3.1 Scout runtime
- Create `src/orchestrator/scout.js`
- Runs as first action in `init` phase
- Detects: language, package manager, frameworks, test runner, linter, CI system
- Outputs `STACK.json` to `.coding_agent_harness/knowledge/`

### 3.2 Living context refresh
- Hook into `coordinateTasks()` pre-execution
- If files changed since last knowledge run → trigger incremental pipeline
- Already partially exists in `bootstrap.js` incremental mode

### Test: Run scout on kiro-swarm itself → verify it detects Node.js, mocha, eslint.

---

## Phase 4: CI/CD & Test Gap Analysis (Goal 4)

### 4.1 CI generator
- Create `src/orchestrator/ci-generator.js`
- Reads `STACK.json` → generates `.github/workflows/ci.yml` or `.gitlab-ci.yml`
- Template-based, not LLM-generated (deterministic)

### 4.2 Test gap analyzer
- Create `src/orchestrator/test-gap.js`
- Uses knowledge skeleton to find source files without corresponding test files
- Outputs `TEST_GAPS.md` with recommended test scaffolds

### 4.3 Benchmark baseline
- Create `src/orchestrator/benchmark.js`
- Runs `npm test` (or detected test command) and captures timing
- Stores baseline in `.coding_agent_harness/knowledge/BASELINE.json`

### Test: Generate CI for kiro-swarm → verify valid YAML. Run test gap → verify it finds untested files.

---

## Phase 5: DevSecOps Witness (Goal 5)

### 5.1 Security tool injection
- Create `src/runtimes/security.js`
- Based on `STACK.json`, installs/configures: semgrep (SAST), osv-scanner (SCA)
- Generates `.semgrep.yml` rules file

### 5.2 Witness agent role
- Create `src/orchestrator/witness.js`
- Runs after each task completion (parallel to existing verifier)
- Executes: `semgrep --config auto`, `osv-scanner`, lint
- On failure: rejects result, feeds CWE log back to worker for retry

### Test: Introduce a known vulnerability in a test file → verify Witness catches it.

---

## Phase 6: Heterogeneous Swarm & Meritocracy (Goal 6)

### 6.1 Multi-runtime task assignment
- Extend planner to assign `runtime` per task (or per task group)
- Mayor can say: "spawn 2 kiro + 2 aider for this task"
- Each gets its own worktree + runtime config

### 6.2 Race mode
- New coordinator mode: `race`
- Same task → N agents in parallel, each in own worktree
- First to pass verification wins

### 6.3 Meritocracy merge
- After race, compare results:
  1. Passes PRINCIPLES.md alignment check
  2. Passes security (Witness)
  3. Beats benchmark baseline
  4. All tests green
- Winner's worktree gets merged, losers get pruned

### Test: Race 2 mock runtimes on a simple task → verify winner selection logic.

---

## Implementation Order & Dependencies

```
Phase 1 (Runtime Engine) ──→ Phase 2 (PRD Lock)
         │                          │
         ├──→ Phase 3 (Scout) ──→ Phase 4 (CI/Test Gap)
         │                          │
         └──→ Phase 5 (Witness) ←───┘
                    │
                    └──→ Phase 6 (Swarm + Meritocracy)
```

## Files to Create

```
src/runtimes/
├── index.js              # Runtime registry
├── translator.js         # Bead → runtime-specific command
├── presets/
│   ├── kiro.json
│   ├── aider.json
│   └── claude-code.json
└── security.js           # SAST/SCA tool injection

src/orchestrator/
├── scout.js              # Stack inference
├── ci-generator.js       # CI/CD generation
├── test-gap.js           # Test coverage gap analysis
├── benchmark.js          # Performance baseline
└── witness.js            # Security verification agent
```

## Files to Modify

- `src/agents/spawner.js` — use runtime registry instead of hardcoded kiro-cli
- `src/orchestrator/coordinator.js` — add race mode, execution gate
- `src/orchestrator/interactive-planner.js` — PRD.md + HARNESS.md output
- `src/orchestrator/actions.js` — wire scout into init, witness into verify
- `src/session/state.js` — add `locked` field
- `src/orchestrator/index.js` — no structural changes, just wiring
