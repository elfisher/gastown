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
