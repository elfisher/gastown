# Dashboard Terminal Experience — xterm.js Plan

## Goal

Every terminal view in the dashboard should look and feel like iTerm. The mayor page is interactive (you can type). Agent pages are read-only (you watch).

## Architecture

```
Browser (xterm.js)  ←→  WebSocket  ←→  Fastify server  ←→  tmux session
```

**Interactive (mayor):** Full bidirectional. Keystrokes go to tmux, output comes back. You're effectively `tmux attach` in a browser tab.

**Read-only (agents):** Server pushes tmux pane content to xterm.js on an interval. The terminal renders it with full ANSI support (colors, cursor, spinners). No keyboard input accepted.

## Dependencies

- `xterm.js` — terminal emulator component (MIT, used by VS Code, Codespaces, Gitpod)
- `@xterm/addon-fit` — auto-resize terminal to container
- `@xterm/addon-web-links` — clickable URLs
- `ws` — WebSocket library for Fastify

```bash
cd dashboard-v2
npm install @xterm/xterm @xterm/addon-fit @xterm/addon-web-links ws
```

## Implementation

### Step 1: WebSocket server for interactive sessions

Add a WebSocket endpoint to the Fastify server that bridges to a tmux session.

```
GET /ws/terminal/:session → WebSocket
```

On connection:
1. Spawn `tmux attach-session -t <session>` as a child process with a pty
2. Pipe pty stdout → WebSocket (binary frames)
3. Pipe WebSocket messages → pty stdin
4. On disconnect, detach (don't kill the session)

Use `node-pty` for the pty layer — it's what VS Code uses.

```bash
npm install node-pty
```

### Step 2: Read-only terminal feed for agent pages

Add a polling endpoint that returns raw tmux pane content with ANSI preserved:

```
GET /api/terminal/:session/raw → raw pane content (text/plain)
```

Uses `tmux capture-pane -t <session> -p -e` (the `-e` flag preserves escape sequences). Returns the raw bytes — xterm.js handles all rendering.

Alternatively, use the same WebSocket approach but in read-only mode (ignore incoming messages, only push pane updates every 2-3s).

### Step 3: xterm.js client component

Create a reusable terminal component:

```
dashboard-v2/src/static/terminal.js
```

Two modes:
- `interactive(wsUrl)` — connects WebSocket, sends keystrokes, renders output
- `readonly(apiUrl, interval)` — polls endpoint, writes to terminal, ignores keyboard

Both use the same xterm.js instance with the same theme/font settings.

### Step 4: Mayor page

Replace the entire mayor page with a single full-height terminal:

```html
<div id="terminal" style="height: calc(100vh - 4rem)"></div>
<script type="module">
  import { interactive } from '/static/terminal.js';
  interactive('ws://localhost:8081/ws/terminal/hq-mayor', '#terminal');
</script>
```

No chat bubbles, no message parsing, no send button. Just a terminal.

### Step 5: Agent pages

Replace the `<pre>` output blocks with read-only terminals:

```html
<div id="terminal" style="height: 60vh"></div>
<script type="module">
  import { readonly } from '/static/terminal.js';
  readonly('/api/terminal/gt-witness/raw', '#terminal', 3000);
</script>
```

Applies to: agent detail, bead detail (agent output section), and the agent cards on the agents list page (small preview terminals).

### Step 6: Styling

Match iTerm defaults:
- Font: `Menlo, Monaco, 'Courier New', monospace` (14px)
- Theme: dark background matching DaisyUI base-300
- Cursor: block, blinking
- Scrollback: 1000 lines

```javascript
const term = new Terminal({
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  theme: { background: '#1d232a' },  // DaisyUI dark base-300
  cursorBlink: true,
  scrollback: 1000,
  disableStdin: readOnly,  // false for mayor, true for agents
});
```

## What This Replaces

- `src/data/terminal.ts` — all the `stripAnsi`, `dedupeSpinnerLines`, noise filtering → DELETE. xterm.js handles ANSI natively.
- `src/pages/mayor.ts` — chat bubble UI → single terminal div
- Agent detail `<pre>` blocks → terminal divs
- The entire text-processing pipeline for terminal output → gone

## Implementation Order

1. Install deps (`xterm.js`, `node-pty`, `ws`)
2. WebSocket endpoint + pty bridge (server-side)
3. Terminal client component (client-side)
4. Mayor page rewrite (interactive)
5. Agent pages rewrite (read-only)
6. Remove old terminal.ts, noise filters, chat UI code

Steps 1-4 are the MVP — you get an interactive mayor terminal. Step 5 extends it to all agent views. Step 6 is cleanup.

## Verification

- Mayor page: type a command, see it execute, see output — same as iTerm
- Agent pages: see live output with colors, spinners animate properly, no ANSI garbage
- Resize browser window → terminal resizes (addon-fit)
- Close browser tab → tmux session stays alive (detach, not kill)
- `npm test` and `npx tsc --noEmit` pass

## Risks

- `node-pty` requires native compilation (node-gyp). May need build tools on the host.
- WebSocket through proxies/firewalls can be tricky. Fallback: long-polling with raw pane content.
- xterm.js bundle size is ~500KB. Acceptable for a dashboard but worth noting.
