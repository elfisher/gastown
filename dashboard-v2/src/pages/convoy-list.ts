import type { Convoy } from "../data/schemas.js";
import { escapeHtml, statusBadge } from "./helpers.js";

export function renderConvoyListPage(convoys: Convoy[], showingAll = false): string {
  if (convoys.length === 0) {
    return `<div class="prose"><h1>Convoys</h1><p class="text-base-content/60">No convoys found.</p></div>`;
  }

  const rows = convoys
    .map(
      (c) => `
      <tr>
        <td><a href="/convoy/${encodeURIComponent(c.id)}" class="link link-hover font-mono text-xs">${escapeHtml(c.id)}</a></td>
        <td>${escapeHtml(c.name)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${c.issue_count ?? c.issues?.length ?? 0}</td>
        <td class="text-xs text-base-content/50">${escapeHtml(c.created_at)}</td>
      </tr>`
    )
    .join("");

  const loadAllButton = showingAll
    ? ""
    : `<button class="btn btn-ghost btn-sm mt-4" hx-get="/convoys?all=true" hx-target="body" hx-swap="innerHTML">Load all convoys (including closed)</button>`;

  return `
<div class="prose max-w-none mb-6"><h1>Convoys</h1></div>
<div class="overflow-x-auto">
  <table class="table table-sm">
    <thead>
      <tr><th>ID</th><th>Name</th><th>Status</th><th>Beads</th><th>Created</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</div>
${loadAllButton}`;
}
