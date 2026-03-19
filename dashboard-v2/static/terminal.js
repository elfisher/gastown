/**
 * terminal.js — xterm.js client component for Gas Town Dashboard.
 *
 * Two modes:
 *   interactive(wsUrl, selector) — full bidirectional WebSocket ↔ tmux
 *   readonly(apiUrl, selector, interval) — polls raw pane content
 */

import { Terminal } from "/vendor/xterm/xterm/lib/xterm.mjs";
import { FitAddon } from "/vendor/xterm/addon-fit/lib/addon-fit.mjs";
import { WebLinksAddon } from "/vendor/xterm/addon-web-links/lib/addon-web-links.mjs";

const THEME = {
  background: "#1d232a",
  foreground: "#a6adba",
  cursor: "#a6adba",
  cursorAccent: "#1d232a",
  selectionBackground: "#3b82f680",
};

const FONT = {
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
};

function createTerminal(readOnly) {
  const term = new Terminal({
    ...FONT,
    theme: THEME,
    cursorBlink: !readOnly,
    scrollback: 1000,
    disableStdin: readOnly,
    convertEol: true,
  });
  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.loadAddon(new WebLinksAddon());
  return { term, fitAddon };
}

/**
 * Interactive terminal — connects to a WebSocket that bridges to tmux via node-pty.
 */
export function interactive(wsUrl, selector) {
  const container = document.querySelector(selector);
  if (!container) return;

  const { term, fitAddon } = createTerminal(false);
  term.open(container);
  fitAddon.fit();

  const ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    // Send initial size
    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
  });

  ws.addEventListener("message", (ev) => {
    const data = typeof ev.data === "string" ? ev.data : new TextDecoder().decode(ev.data);
    term.write(data);
  });

  ws.addEventListener("close", (ev) => {
    term.write(`\r\n\x1b[33m[session disconnected: ${ev.reason || "closed"}]\x1b[0m\r\n`);
  });

  // Keystrokes → WebSocket
  term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // Resize → WebSocket
  term.onResize(({ cols, rows }) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  });

  // Window resize → fit
  const ro = new ResizeObserver(() => fitAddon.fit());
  ro.observe(container);

  return { term, ws };
}

/**
 * Read-only terminal — polls raw tmux capture-pane output.
 * @param {string} apiUrl - URL to poll for raw pane content
 * @param {string|Element} selectorOrEl - CSS selector string or DOM element
 * @param {number} interval - polling interval in ms
 */
export function readonly(apiUrl, selectorOrEl, interval = 3000) {
  const container = typeof selectorOrEl === 'string'
    ? document.querySelector(selectorOrEl)
    : selectorOrEl;
  if (!container) return;

  const { term, fitAddon } = createTerminal(true);
  term.open(container);
  fitAddon.fit();

  async function poll() {
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) return;
      const text = await res.text();
      term.reset();
      term.write(text);
    } catch {
      // Silently retry on next interval
    }
  }

  poll();
  const timer = setInterval(poll, interval);

  const ro = new ResizeObserver(() => fitAddon.fit());
  ro.observe(container);

  return { term, stop: () => clearInterval(timer) };
}
