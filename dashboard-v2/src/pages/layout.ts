import type { Rig } from "../data/schemas.js";
import { escapeHtml } from "./helpers.js";

export function renderLayout(
  title: string,
  content: string,
  rigs: Rig[],
  activePath?: string
): string {
  const navItems = [
    { href: "/", label: "Pipeline", icon: "📊" },
    { href: "/agents", label: "Agents", icon: "🤖" },
    { href: "/mayor", label: "Mayor", icon: "🎩" },
    { href: "/tour", label: "Tour", icon: "🗺️" },
  ];

  const rigItems = rigs.map(
    (r) => `
    <li>
      <a href="/rig/${encodeURIComponent(r.name)}"
         class="${activePath === `/rig/${r.name}` ? "active" : ""}">
        <span class="badge badge-sm ${r.status === "operational" ? "badge-success" : "badge-warning"}">●</span>
        ${escapeHtml(r.name)}
        <span class="badge badge-ghost badge-xs">${r.polecats}p</span>
      </a>
    </li>`
  );

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — Gas Town</title>
  <link href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@2.0.0"></script>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  <div class="drawer lg:drawer-open">
    <input id="drawer-toggle" type="checkbox" class="drawer-toggle">
    <div class="drawer-content p-6">
      <div class="lg:hidden mb-4">
        <label for="drawer-toggle" class="btn btn-ghost btn-sm">☰ Menu</label>
      </div>
      ${content}
    </div>
    <div class="drawer-side">
      <label for="drawer-toggle" aria-label="close sidebar" class="drawer-overlay"></label>
      <div class="menu bg-base-200 text-base-content min-h-full w-64 p-4">
        <div class="text-xl font-bold mb-4 px-2">⛽ Gas Town</div>
        <ul class="menu-sm">
          ${navItems
            .map(
              (item) => `
          <li>
            <a href="${item.href}"
               class="${activePath === item.href ? "active" : ""}">
              ${item.icon} ${item.label}
            </a>
          </li>`
            )
            .join("")}
        </ul>
        <div class="divider">Rigs</div>
        <ul class="menu-sm">
          ${rigItems.join("")}
        </ul>
      </div>
    </div>
  </div>
  <script src="/static/app.js"></script>
</body>
</html>`;
}
