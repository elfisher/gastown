export function renderMayorPage(): string {
  return `<div class="flex flex-col h-[calc(100vh-4rem)]">
    <div id="terminal" class="flex-1 min-h-0"></div>
    <link rel="stylesheet" href="/vendor/xterm/xterm/css/xterm.css">
    <script type="module">
      import { interactive } from '/static/terminal.js';
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      interactive(proto + '//' + location.host + '/ws/terminal/hq-mayor', '#terminal');
    </script>
  </div>`;
}
