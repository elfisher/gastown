# Coding Harness Bootstrap — Product Spec

## Problem

When GT onboards a new rig, agents are dropped into a codebase they know nothing about. They don't know how to build it, what tests to run, what conventions to follow, or where anything is. Today the human manually writes AGENTS.md, configures harness commands, and hopes agents read the docs.

Meanwhile, the codebase already has most of this information — in CI configs, READMEs, lint configs, and test directories. Nobody extracts it for the agents.

## Product Goal

`gt rig bootstrap` analyzes a codebase and automatically configures GT so agents can work on it effectively from day one. It discovers what the repo already has, extracts actionable information, and wires it into GT's existing context injection and verification systems.

Works on new rigs and existing rigs alike. On existing rigs it fills gaps, warns on conflicts, and never overwrites manual customizations.

## User Stories

### New rig

I add a new rig: `gt rig add myapp --url https://github.com/myorg/myapp.git`

Then I run: `gt rig bootstrap myapp`

It scans the repo, finds the GitHub Actions CI config, extracts `npm test` and `npm run lint` as the verification commands, finds README.md with setup instructions, finds .eslintrc for coding standards, and discovers the test directory structure.

It outputs:
```
✓ Discovered: GitHub Actions CI (2 workflows)
✓ Extracted: build=npm run build, test=npm test, lint=npm run lint, typecheck=npx tsc --noEmit
✓ Found: README.md, CONTRIBUTING.md, .eslintrc.json, tsconfig.json
✓ Found: tests in __tests__/ (jest framework)
✓ Generated: .gastown/harness.yaml (from CI extraction)
✓ Updated: config.json (setup_command, test_command, build_command, lint_command)
✓ Generated: AGENTS.md (with pointers to existing docs)
✓ Generated: CODEBASE_MAP.md (directory structure + module overview)

Agents will now:
  - Run npm test + npm run lint before every gt done
  - Read README.md for setup, CONTRIBUTING.md for standards
  - See codebase structure via CODEBASE_MAP.md at prime time
```

From this point, polecats slung against this rig automatically get the right context and verification gates. No manual configuration needed.

### Existing rig

I already have the gastown rig running with some manual config. I run: `gt rig bootstrap gastown`

It scans the repo, compares with what's already configured:

```
✓ Discovered: go.mod (Go project)
✓ Discovered: Makefile with targets: build, test, lint
○ config.json build_command already set: go build ./... (matches discovery)
○ config.json test_command already set: go test ./... (matches discovery)
⚠ CI has lint command: golangci-lint run — but config.json lint_command is empty. Add? [y/n]
✓ Found: .gastown/harness.yaml (preserving existing verify tier)
✓ Updated: harness.yaml tier1 += golangci-lint run
○ AGENTS.md exists (preserving manual content, appending discovered docs section)
✓ Found: docs/bounded-yolo/ (6 docs) — added to AGENTS.md references
```

### Re-run behavior

Bootstrap is safe to run repeatedly. On re-run it:

- **Fills gaps** — if config.json has `build_command` but no `lint_command`, and bootstrap discovers a lint command in CI, it adds the missing one
- **Warns on conflicts** — if config.json says `npm test` but CI says `jest --coverage`, it asks: "CI uses `jest --coverage` but config has `npm test` — update? [y/n]"
- **Never overwrites manual additions** — if harness.yaml has a `verify` tier with custom assertions, bootstrap leaves it alone (it only manages tier0/tier1 from discovery)
- **Never overwrites manual AGENTS.md content** — appends a `## Discovered` section, preserves everything above it
- **Refreshes stale detection** — if the repo added a new CI workflow since last bootstrap, it picks it up

### Flags

| Flag | Behavior |
|------|----------|
| (none) | Interactive — prompts on conflicts, fills gaps |
| `--refresh` | Force full re-scan, re-extract everything (still prompts on conflicts) |
| `--dry-run` | Show what would change without writing anything |
| `--yes` | Non-interactive — accept all discovered values, no prompts |

## Success Criteria

1. **Zero manual harness config for common setups.** Go, Node/TypeScript, Python, Rust projects with standard CI should be fully configured by bootstrap alone.
2. **Agents pass CI on first try more often.** The harness runs the same commands CI runs. If the agent's code passes the harness, it passes CI.
3. **Agents understand the codebase faster.** CODEBASE_MAP.md + doc pointers in AGENTS.md give agents structural context without reading every file.
4. **Existing repo artifacts are respected.** Bootstrap never generates files that duplicate what the repo already has. It points to existing docs, not replaces them.
5. **Bootstrap is idempotent.** Running it twice produces the same result. Running it after repo changes updates the config without losing manual customizations.

## Non-Goals

- LLM-powered code analysis (too expensive, too slow, stale quickly)
- Per-file summaries or knowledge indexing (Kiro has LSP/code intelligence for this)
- Replacing CI (bootstrap reads CI, doesn't replace it)
- Supporting every CI system on day one (start with GitHub Actions + Makefile + package.json scripts)

## What Bootstrap Discovers

### Build System Detection (already exists in detect.go)

| File | Detected As | Default Commands |
|------|------------|-----------------|
| go.mod | Go | `go build ./...`, `go test ./...` |
| package.json | Node/TypeScript | `npm test`, `npm run build` |
| Cargo.toml | Rust | `cargo build`, `cargo test` |
| Makefile | Make | `make test`, `make build` |
| pyproject.toml / setup.py | Python | `pytest`, `python -m build` |

### CI Config Extraction (new)

Parse CI configs to extract the actual commands the project runs:

**GitHub Actions** (`.github/workflows/*.yml`):
- Find `run:` steps in jobs
- Extract build, test, lint, typecheck commands
- Respect matrix builds (extract the common commands)
- Ignore deployment/release steps

**Makefile**:
- Parse target names: `test`, `lint`, `build`, `check`, `typecheck`
- Extract the commands under each target

**package.json scripts**:
- Read `scripts` field: `test`, `lint`, `build`, `typecheck`, `check`
- Map to npm/yarn/pnpm run commands

CI extraction takes priority over convention detection. If CI says `npm run test:unit && npm run test:integration`, that's more accurate than the generic `npm test` from detect.go.

### Documentation Discovery

Scan repo root and common locations for existing docs:

| File | Purpose | How GT Uses It |
|------|---------|---------------|
| README.md | Setup, overview | AGENTS.md points to it |
| CONTRIBUTING.md | Coding standards, PR process | AGENTS.md points to it |
| ARCHITECTURE.md / docs/architecture.md | Codebase structure | Injected by gt prime |
| CLAUDE.md | Claude-specific instructions | Left untouched |
| .editorconfig | Formatting rules | AGENTS.md mentions it |

### Convention Discovery

Scan for config files that encode project conventions:

| File | What It Tells Agents |
|------|---------------------|
| .eslintrc* / eslint.config.* | Lint rules to follow |
| .prettierrc* | Formatting rules |
| tsconfig.json | TypeScript strictness, paths |
| golangci-lint.yml | Go lint rules |
| rustfmt.toml | Rust formatting |
| .editorconfig | Indentation, line endings |
| jest.config.* / vitest.config.* | Test framework, test patterns |
| pytest.ini / pyproject.toml [tool.pytest] | Python test config |

### Test Structure Discovery

Find where tests live and what framework is used:

- Scan for test directories: `test/`, `tests/`, `__tests__/`, `*_test.go`, `*.test.ts`
- Detect framework from config files or imports
- Map test directories to source directories (convention-based)

## What Bootstrap Generates

### 1. `.gastown/harness.yaml`

Verification commands extracted from CI or detected from build system:

```yaml
tier0:
  - npm run build
  - npm test
tier1:
  - npm run lint
  - npx tsc --noEmit
```

This feeds into GT's existing harness system (`LoadHarness` → `RunHarness`). Every `gt done` runs these commands.

### 2. Rig `config.json` enrichment

Populates the formula variables that polecats use:

```json
{
  "setup_command": "npm install",
  "build_command": "npm run build",
  "test_command": "npm test",
  "lint_command": "npm run lint",
  "typecheck_command": "npx tsc --noEmit",
  "harness_defaults": {
    "tier0": ["npm run build", "npm test"],
    "tier1": ["npm run lint", "npx tsc --noEmit"]
  }
}
```

These flow into `mol-polecat-work` formula variables automatically.

### 3. `AGENTS.md`

Generated with pointers to existing docs, not duplicating content:

```markdown
# Agent Instructions

## Project Setup
See [README.md](README.md) for setup instructions.

## Coding Standards
See [CONTRIBUTING.md](CONTRIBUTING.md) for coding standards.
Lint config: .eslintrc.json (ESLint)
Format config: .prettierrc (Prettier)
TypeScript config: tsconfig.json (strict mode)

## Testing
Framework: Jest
Test directory: __tests__/
Run tests: npm test

## Verification
Before submitting work, these must pass:
- npm run build (tier0)
- npm test (tier0)
- npm run lint (tier1)
- npx tsc --noEmit (tier1)

## Operational Guidelines
See GT.md for Gas Town operational guidelines.
```

If AGENTS.md already exists, bootstrap merges — it adds missing sections without overwriting manual content.

### 4. `CODEBASE_MAP.md` (only if no architecture doc exists)

Generated from directory scanning — no LLM needed:

```markdown
# Codebase Map

## Structure
src/           — application source
  api/         — REST API handlers (12 files)
  models/      — database models (8 files)
  services/    — business logic (15 files)
  utils/       — shared utilities (6 files)
test/          — test files (mirror src/ structure)
docs/          — documentation
scripts/       — build and deployment scripts

## Entry Points
- src/index.ts — application entry
- src/api/routes.ts — API route definitions

## Dependencies
- express (web framework)
- prisma (ORM)
- jest (testing)
- typescript (language)

## Key Patterns
- Tests mirror source structure (src/api/users.ts → test/api/users.test.ts)
- All API handlers export a Fastify plugin function
- Database access through Prisma client (src/models/prisma.ts)
```

This is deterministic — generated from `ls`, `package.json`, and import scanning. No LLM calls. If the repo already has ARCHITECTURE.md or similar, bootstrap skips this and points AGENTS.md at the existing doc instead.

## How It Integrates With Existing GT Systems

### gt prime
Already injects AGENTS.md and GT.md. After bootstrap:
- Also injects CODEBASE_MAP.md (or existing architecture doc) for polecats
- No code change needed if we put the pointer in AGENTS.md

### Harness system (internal/harness/)
Already has detect.go, runner.go, harness.go, config.go. After bootstrap:
- harness.yaml is populated from CI extraction (more accurate than detect.go alone)
- config.json harness_defaults are populated
- `gt done` automatically runs the right commands

### Polecat formula (mol-polecat-work)
Already has setup_command, test_command, etc. variables. After bootstrap:
- Variables are populated from config.json
- Polecats run the right setup and verification commands without manual config

### gt doctor
Can add a check: "rig has bootstrap artifacts" — warn if harness.yaml is missing or config.json has empty commands.

## Implementation Order

1. **CI config parser** — parse GitHub Actions YAML, extract run commands, categorize as build/test/lint/typecheck. This is the highest-value piece.
2. **Repo scanner** — find all existing docs, lint configs, test dirs. Produce a discovery manifest.
3. **Config wirer** — take parsed commands + manifest → populate config.json + harness.yaml
4. **AGENTS.md generator** — template that references discovered docs
5. **CODEBASE_MAP.md generator** — directory scanner + manifest reader (only if no architecture doc)
6. **`gt rig bootstrap` command** — orchestrate: scan → parse → wire → generate → commit
7. **Idempotency** — re-running bootstrap updates without clobbering manual edits

Steps 1-3 are the MVP. A rig gets correct build/test/lint commands from its own CI config. Steps 4-5 add context. Steps 6-7 make it a proper command.

## Risks

- **CI config parsing is fragile.** GitHub Actions YAML can be complex (matrix, reusable workflows, composite actions). Start with simple cases, fail gracefully on complex ones.
- **Monorepos.** A repo with multiple projects needs per-directory harness configs. Defer to v2.
- **Stale bootstrap.** If CI config changes, the harness is stale. Mitigation: `gt doctor` warns when harness.yaml is older than CI config. `gt rig bootstrap --refresh` re-runs.
- **Manual overrides lost.** If the user customizes harness.yaml and re-runs bootstrap, customizations could be lost. Mitigation: bootstrap only writes fields it discovered, preserves unknown fields.
