import { getBead, getBeadHistory } from "../data/beads.js";
import { listConvoys } from "../data/convoys.js";
import { escapeHtml, statusBadge, priorityLabel } from "./helpers.js";
import { linkify } from "./linkify.js";
import type { BeadDetail, BeadHistoryEntry } from "../data/schemas.js";

/** Extract rig name from bead ID prefix (e.g. "gt-abc" → "gastown" via prefix lookup) */
function rigFromAssignee(assignee?: string): string | undefined {
  if (!assignee) return undefined;
  // assignee format: "gastown/polecats/furiosa" or "gastown/crew/dom"
  const parts = assignee.split("/");
  return parts[0];
}

/** Parse description for checklist items (lines starting with - [ ] or - [x]) */
function parseChecklist(description: string): { text: string; checked: boolean }[] {
  const items: { text: string; checked: boolean }[] = [];
  for (const line of description.split("\n")) {
    const m = /^[-*]\s+\[([ xX])\]\s+(.+)/.exec(line.trim());
    if (m) {
      items.push({ text: m[2]!, checked: m[1] !== " " });
    }
  }
  return items;
}

/** Strip metadata preamble (key: value lines at top) from description */
function stripMetadata(description: string): string {
  const lines = description.split("\n");
  let i = 0;
  // Skip lines that look like "key: value" or "key: [value]"
  while (i < lines.length && /^[a-z_]+:/.test(lines[i]!.trim())) {
    i++;
  }
  // Skip blank lines after metadata
  while (i < lines.length && lines[i]!.trim() === "") {
    i++;
  }
  return lines.slice(i).join("\n");
}

function renderBreadcrumbs(bead: BeadDetail, rigName?: string, convoyId?: string): string {
  const crumbs = [`<a href="/" class="link link-hover">Gas Town</a>`];
  if (rigName) {
    crumbs.push(`<a href="/rig/${encodeURIComponent(rigName)}" class="link link-hover">${escapeHtml(rigName)}</a>`);
  }
  if (convoyId) {
    crumbs.push(`<a href="/convoy/${encodeURIComponent(convoyId)}" class="link link-hover">${escapeHtml(convoyId)}</a>`);
  }
  crumbs.push(`<span>${escapeHtml(bead.id)}</span>`);
  return `<div class="text-sm breadcrumbs mb-4"><ul>${crumbs.map((c) => `<li>${c}</li>`).join("")}</ul></div>`;
}

function renderTimeline(history: BeadHistoryEntry[]): string {
  if (history.length === 0) {
    return `<p class="text-base-content/50 text-sm">No history available</p>`;
  }
  const items = history.map((e) => `
    <li>
      <div class="timeline-start text-xs text-base-content/50">${escapeHtml(e.date)}</div>
      <div class="timeline-middle"><span class="badge badge-xs badge-primary"></span></div>
      <div class="timeline-end timeline-box text-sm">
        <span class="font-semibold">${escapeHtml(e.committer)}</span>
        → ${statusBadge(e.status)}
      </div>
      <hr/>
    </li>`).join("");
  return `<ul class="timeline timeline-vertical timeline-compact">${items}</ul>`;
}

function renderDescription(description: string): string {
  const clean = stripMetadata(description);
  if (!clean.trim()) return `<p class="text-base-content/50">No description</p>`;

  const checklist = parseChecklist(clean);
  const sections: string[] = [];

  // Render non-checklist description text
  const descLines = clean.split("\n").filter((l) => !/^[-*]\s+\[[ xX]\]/.test(l.trim()));
  const descText = descLines.join("\n").trim();
  if (descText) {
    sections.push(`<div class="whitespace-pre-wrap text-sm">${linkify(escapeHtml(descText))}</div>`);
  }

  // Render checklist as acceptance criteria
  if (checklist.length > 0) {
    const items = checklist.map((c) =>
      `<li><label class="flex items-center gap-2 cursor-default">
        <input type="checkbox" class="checkbox checkbox-sm" ${c.checked ? "checked" : ""} disabled />
        <span class="text-sm">${linkify(escapeHtml(c.text))}</span>
      </label></li>`
    ).join("");
    sections.push(`
      <h3 class="text-md font-bold mt-4 mb-2">Acceptance Criteria</h3>
      <ul class="list-none p-0 m-0 space-y-1">${items}</ul>`);
  }

  return sections.join("");
}

function renderDeps(bead: BeadDetail): string {
  const deps = bead.dependencies ?? [];
  const dependents = bead.dependents ?? [];
  if (deps.length === 0 && dependents.length === 0) return "";

  const depRows = (items: typeof deps, label: string) => {
    if (items.length === 0) return "";
    const rows = items.map((d) => `
      <tr>
        <td><a href="/bead/${encodeURIComponent(d.id)}" class="link link-hover font-mono text-xs">${escapeHtml(d.id)}</a></td>
        <td class="text-sm">${escapeHtml(d.title)}</td>
        <td>${statusBadge(d.status)}</td>
        <td>${priorityLabel(d.priority)}</td>
      </tr>`).join("");
    return `
      <h3 class="text-md font-bold mt-4 mb-2">${label}</h3>
      <div class="overflow-x-auto">
        <table class="table table-sm">
          <thead><tr><th>ID</th><th>Title</th><th>Status</th><th>Priority</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  };

  return depRows(deps, "Depends On") + depRows(dependents, "Blocks");
}

export async function renderBeadPage(id: string): Promise<string> {
  let bead: BeadDetail;
  try {
    bead = await getBead(id);
  } catch {
    return `<div class="prose"><h1>Bead Not Found</h1><p>No bead with ID "${escapeHtml(id)}".</p></div>`;
  }

  // Find convoy containing this bead
  let convoyId: string | undefined;
  try {
    const convoys = await listConvoys();
    const match = convoys.find((c) => c.issues?.includes(id));
    convoyId = match?.id;
  } catch {
    // no convoy info
  }

  // Fetch history for timeline
  let history: BeadHistoryEntry[] = [];
  try {
    history = await getBeadHistory(id);
  } catch {
    // no history
  }

  const rigName = rigFromAssignee(bead.assignee);

  return `
${renderBreadcrumbs(bead, rigName, convoyId)}

<div class="prose max-w-none mb-6">
  <h1>${escapeHtml(bead.title)}</h1>
  <div class="flex gap-2 items-center not-prose flex-wrap">
    ${statusBadge(bead.status)}
    ${priorityLabel(bead.priority)}
    <span class="badge badge-ghost font-mono text-xs">${escapeHtml(bead.id)}</span>
    <span class="badge badge-ghost text-xs">${escapeHtml(bead.issue_type)}</span>
    ${bead.assignee ? `<span class="text-sm text-base-content/50">→ ${escapeHtml(bead.assignee)}</span>` : ""}
  </div>
</div>

<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
  <div class="lg:col-span-2 space-y-6">
    <div>
      <h2 class="text-lg font-bold mb-3">Description</h2>
      ${renderDescription(bead.description ?? "")}
    </div>

    ${renderDeps(bead)}

    ${bead.assignee ? `
    <div>
      <h2 class="text-lg font-bold mb-3">Agent Output</h2>
      <pre class="bg-base-200 rounded-lg p-4 text-xs overflow-x-auto max-h-96 whitespace-pre-wrap"><code>Agent: ${escapeHtml(bead.assignee)}
Status: ${escapeHtml(bead.status)}
Updated: ${escapeHtml(bead.updated_at)}</code></pre>
    </div>` : ""}
  </div>

  <div>
    <h2 class="text-lg font-bold mb-3">Timeline</h2>
    ${renderTimeline(history)}

    <h2 class="text-lg font-bold mt-6 mb-3">Details</h2>
    <div class="space-y-2 text-sm">
      <div><span class="text-base-content/50">Created:</span> ${escapeHtml(bead.created_at)}</div>
      <div><span class="text-base-content/50">Updated:</span> ${escapeHtml(bead.updated_at)}</div>
      ${bead.closed_at ? `<div><span class="text-base-content/50">Closed:</span> ${escapeHtml(bead.closed_at)}</div>` : ""}
      ${bead.owner ? `<div><span class="text-base-content/50">Owner:</span> ${escapeHtml(bead.owner)}</div>` : ""}
      ${bead.created_by ? `<div><span class="text-base-content/50">Created by:</span> ${escapeHtml(bead.created_by)}</div>` : ""}
      ${bead.close_reason ? `<div><span class="text-base-content/50">Close reason:</span> ${escapeHtml(bead.close_reason)}</div>` : ""}
    </div>
  </div>
</div>`;
}
