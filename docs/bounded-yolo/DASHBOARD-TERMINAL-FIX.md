# Dashboard Terminal Experience — Fix Plan

## Problem

Every page that shows agent terminal output has the same issues:

1. **Raw ANSI escape codes visible** — `[?2004l`, `[?2004h`, `ESC[0m` etc leak through
2. **Repeated nudge/system messages** — the same "Dolt server is DOWN" message appears 5+ times
3. **Spinner frame spam** — `⠋ Thinking...` repeated 50+ times instead of collapsing to one line
4. **Mayor page is a chat UI, not a terminal** — uses chat bubbles and message rendering instead of showing the actual tmux session like other agent pages

## Root Cause

Two separate issues:

**A. Mayor page architecture is wrong.** It renders `MayorMessage` objects as chat bubbles. Every other agent page renders raw terminal output via `getSessionOutput()`. The mayor page should work the same way — show the tmux session content, not a parsed message list.

**B. Terminal filtering is incomplete.** `src/data/terminal.ts` has `stripAnsi()` and `dedupeSpinnerLines()` but:
- `stripAnsi` doesn't catch all escape sequences (misses `[?2004l` bracket paste mode)
- Nudge dedup doesn't exist — repeated identical system messages aren't collapsed
- The noise filter patterns don't catch `<system-reminder>` blocks

## Fix Plan

### Step 1: Rewrite mayor page as terminal view

Replace `src/pages/mayor.ts` entirely. Instead of rendering `MayorMessage[]` as chat bubbles:

```typescript
// OLD: chat bubble UI
export function renderMayorPage(messages: MayorMessage[]): string { ... }

// NEW: terminal view, same as agent detail
export async function renderMayorPage(): Promise<string> {
  const output = await getSessionOutput("hq-mayor", 80);
  return `<div>
    <h1>🎩 Mayor</h1>
    <div id="mayor-terminal"
         hx-get="/api/mayor/terminal"
         hx-trigger="every 3s"
         hx-swap="innerHTML">
      ${renderTerminalOutput(output)}
    </div>
  </div>`;
}
```

Add `/api/mayor/terminal` endpoint in routes that calls `getSessionOutput("hq-mayor")`.

Remove the send message form, toast notification, and chat-related code.

### Step 2: Fix ANSI stripping

In `src/data/terminal.ts`, the `stripAnsi` regex needs to catch:
- Standard CSI sequences: `ESC[...m` (colors) — already handled
- Bracket paste mode: `ESC[?2004h`, `ESC[?2004l` — NOT handled
- Cursor movement: `ESC[nA`, `ESC[nB`, etc — partially handled
- OSC sequences: `ESC]...BEL` — NOT handled

Replace with a comprehensive regex:
```typescript
function stripAnsi(line: string): string {
  return line
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")  // CSI sequences including ?
    .replace(/\x1b\][^\x07]*\x07/g, "")        // OSC sequences
    .replace(/\x1b[()][AB012]/g, "")            // Character set selection
    .replace(/\r/g, "");                         // Carriage returns
}
```

### Step 3: Dedup repeated messages

Add a `dedupeConsecutiveBlocks()` function that collapses consecutive identical multi-line blocks. A "block" is defined as 3+ consecutive lines that repeat verbatim.

```typescript
function dedupeConsecutiveBlocks(lines: string[]): string[] {
  // If the same block of lines appears consecutively, keep only the first
  // occurrence and add a "(repeated N times)" note
}
```

This catches the repeated nudge messages without needing to know their specific format.

### Step 4: Filter system-reminder noise

Add to the noise patterns in terminal.ts:
```typescript
/^<\/?system-reminder>/,
/^QUEUED NUDGE/,
/^This is a background notification/,
```

Or better: detect `<system-reminder>...</system-reminder>` blocks and collapse them into a single summary line: `[system] Refinery patrol: Dolt server is DOWN`

### Step 5: Shared terminal renderer

Extract the terminal rendering into a shared component used by ALL pages:

```typescript
// src/pages/components/terminal.ts
export function renderTerminalOutput(output: string): string {
  return `<pre class="text-sm whitespace-pre-wrap font-mono bg-base-300 p-4 rounded-box overflow-auto max-h-[60vh]">${escapeHtml(output)}</pre>`;
}
```

Pages that show terminal output (mayor, agent detail, bead detail) all use this. One place to fix rendering issues.

### Step 6: Add htmx auto-scroll

The terminal view should auto-scroll to the bottom (latest output) but respect manual scroll position — if the user scrolls up to read history, don't yank them back down.

```html
<div id="terminal"
     hx-get="/api/mayor/terminal"
     hx-trigger="every 3s"
     hx-swap="innerHTML"
     hx-on::after-settle="if(this.dataset.userScrolled!=='true') this.scrollTop=this.scrollHeight">
```

## Implementation Order

1. Step 2 (ANSI stripping) — fixes all pages immediately
2. Step 3 (block dedup) — fixes repeated nudges everywhere
3. Step 4 (system-reminder filter) — cleans up noise
4. Step 1 (mayor rewrite) — biggest change, depends on 2-4 being solid
5. Step 5 (shared component) — refactor, not urgent
6. Step 6 (auto-scroll) — polish

Steps 1-4 are the must-haves. Steps 5-6 are nice-to-haves.

## Verification

After each step, check:
- `curl -s http://localhost:8081/mayor | grep -c "\\[?"` should be 0 (no ANSI leaks)
- `curl -s http://localhost:8081/mayor | grep -c "Thinking"` should be 0 or 1 (no spinner spam)
- Repeated nudge messages should appear once, not 5+ times
- No `<system-reminder>` tags visible in the rendered page
- `npm test` and `npx tsc --noEmit` pass
