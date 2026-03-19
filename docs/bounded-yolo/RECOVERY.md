# Recovery Playbook

When GT is in a broken state, follow these steps in order.

## Step 1: Stop everything

```bash
gt down --polecats
```

## Step 2: Verify Dolt

```bash
gt dolt start
bd list                                    # from ~/gt (HQ database)
cd ~/gt/gastown/mayor/rig && bd list       # from rig (gastown database)
```

If `bd list` works from both locations, Dolt is healthy. Skip to Step 3.

If you see **PROJECT IDENTITY MISMATCH**:
- **Do NOT change metadata.json.** The metadata project_id was set when the rig was created and is the source of truth.
- The error means the Dolt server is serving a different database instance.
- Check what Dolt is serving: `lsof -i :3307` → find the process → check its data directory.
- The fix is usually restarting Dolt so it picks up the correct `.dolt-data/` directory.

## Step 3: Verify rig config

```bash
cat ~/gt/gastown/config.json
```

Both `default_branch` and `base_branch` should be `main` (or whatever your working branch is). If they point at a deleted branch, fix them.

## Step 4: Clean up stale state

```bash
gt doctor --triage              # shows orphaned wisps and stale hooks
gt doctor --triage --fix        # closes orphaned wisps
```

For stale hooks (hooked beads with no active polecat session):
```bash
bd update <bead-id> --status open --assignee ""
```

Kill any orphaned polecat tmux sessions:
```bash
tmux list-sessions | grep "gt-"
tmux kill-session -t <session-name>
```

## Step 5: Audit what's done vs open

```bash
# What's merged to main
GIT_DIR=~/gt/gastown/.repo.git git log --oneline origin/main -20

# What beads are open
cd ~/gt/gastown/mayor/rig && bd list
```

If a bead's work is on main but the bead is still open, close it:
```bash
bd close <bead-id> --force --reason "Already merged to main"
```

## Step 6: Start clean

```bash
gt up
gt doctor --triage    # verify everything is green
```

## Step 7: Dispatch work

Create convoys, sling beads, verify with `gt convoy list`.

## Rules

1. **Never change metadata.json project_id.** The data is almost certainly still there — you're just looking at it wrong.
2. **Never run `bd init` on an existing rig.** It destroys all beads data.
3. **Never run `bd init --force`.** There is no recovery from this.
4. **If beads seem "wiped", check the project ID mismatch first.** The data is probably fine.
5. **`gt doctor --fix` is safe.** It will never reinitialize a database (as of the March 2026 fix).
