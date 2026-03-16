export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function statusBadge(status: string): string {
  const cls = statusColor(status);
  return `<span class="badge badge-sm ${cls}">${escapeHtml(status)}</span>`;
}

export function statusColor(status: string): string {
  switch (status.toLowerCase()) {
    case "closed":
    case "merged":
    case "operational":
    case "running":
      return "badge-success";
    case "in_progress":
    case "hooked":
    case "active":
      return "badge-info";
    case "blocked":
    case "error":
    case "failed":
      return "badge-error";
    case "open":
    case "pending":
      return "badge-warning";
    default:
      return "badge-ghost";
  }
}

export function priorityLabel(p: number): string {
  const labels: Record<number, string> = {
    0: '<span class="badge badge-error badge-xs">P0</span>',
    1: '<span class="badge badge-warning badge-xs">P1</span>',
    2: '<span class="badge badge-info badge-xs">P2</span>',
    3: '<span class="badge badge-ghost badge-xs">P3</span>',
    4: '<span class="badge badge-ghost badge-xs">P4</span>',
  };
  return labels[p] ?? `<span class="badge badge-ghost badge-xs">P${p}</span>`;
}
