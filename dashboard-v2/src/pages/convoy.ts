import { getConvoy } from "../data/convoys.js";
import { listBeads, getBead } from "../data/beads.js";
import { escapeHtml, statusBadge, statusColor, priorityLabel } from "./helpers.js";
import { linkify } from "./linkify.js";
import type { Bead, BeadDep } from "../data/schemas.js";

interface DagNode {
  id: string;
  title: string;
  status: string;
  priority: number;
}

interface DagEdge {
  source: string;
  target: string;
}

export async function renderConvoyPage(id: string): Promise<string> {
  let convoy;
  try {
    convoy = await getConvoy(id);
  } catch {
    return `<div class="prose"><h1>Convoy Not Found</h1><p>No convoy with ID "${escapeHtml(id)}".</p></div>`;
  }

  const issueIds = convoy.issues ?? [];
  // Fetch all beads to find convoy members and their deps
  let allBeads: Bead[] = [];
  try {
    allBeads = await listBeads();
  } catch {
    // continue with empty
  }

  const convoyBeads = allBeads.filter((b) => issueIds.includes(b.id));
  const nodes: DagNode[] = convoyBeads.map((b) => ({
    id: b.id,
    title: b.title,
    status: b.status,
    priority: b.priority,
  }));

  // Build edges from bead dependency data
  const edges: DagEdge[] = [];
  const idSet = new Set(issueIds);
  const depResults = await Promise.all(
    convoyBeads.map((b) => getBead(b.id).catch(() => null))
  );
  for (const detail of depResults) {
    if (!detail?.dependencies) continue;
    for (const dep of detail.dependencies) {
      if (idSet.has(dep.id)) {
        edges.push({ source: dep.id, target: detail.id });
      }
    }
  }

  const beadRows = convoyBeads.length > 0
    ? convoyBeads.map((b) => `
      <tr>
        <td><a href="/bead/${encodeURIComponent(b.id)}" class="link link-hover font-mono text-xs">${escapeHtml(b.id)}</a></td>
        <td>${escapeHtml(b.title)}</td>
        <td>${statusBadge(b.status)}</td>
        <td>${linkify(escapeHtml(b.assignee ?? "—"))}</td>
        <td>${priorityLabel(b.priority)}</td>
      </tr>`).join("")
    : `<tr><td colspan="5" class="text-base-content/50">No beads in convoy</td></tr>`;

  // Serialize DAG data for client-side ELK rendering
  const dagData = JSON.stringify({ nodes, edges });

  return `
<div class="prose max-w-none mb-6">
  <h1>Convoy: ${escapeHtml(convoy.name)}</h1>
  <div class="flex gap-2 items-center not-prose">
    ${statusBadge(convoy.status)}
    <span class="badge badge-ghost">${escapeHtml(convoy.id)}</span>
    <span class="text-sm text-base-content/50">${convoy.issue_count ?? issueIds.length} beads</span>
  </div>
</div>

<div class="mb-6">
  <h2 class="text-lg font-bold mb-3">Dependency DAG</h2>
  <div id="dag-container" class="bg-base-200 rounded-lg p-4 min-h-[200px] flex items-center justify-center">
    <span class="loading loading-spinner loading-md" id="dag-loading"></span>
  </div>
  <script>
    window.__dagData = ${dagData};
  </script>
</div>

<div>
  <h2 class="text-lg font-bold mb-3">Beads</h2>
  <div class="overflow-x-auto">
    <table class="table table-sm">
      <thead>
        <tr><th>ID</th><th>Title</th><th>Status</th><th>Agent</th><th>Priority</th></tr>
      </thead>
      <tbody>${beadRows}</tbody>
    </table>
  </div>
</div>`;
}
