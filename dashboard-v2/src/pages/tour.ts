/** Guided tour page — explains Gas Town concepts and lets users restart the tour. */

export function renderTourPage(): string {
  const steps = [
    { icon: "📊", title: "Pipeline", desc: "The pipeline view shows all beads flowing through your workspace — open, in-progress, and completed work items organized by stage." },
    { icon: "🏗️", title: "Rigs", desc: "Rigs are project containers. Each rig wraps a git repository and manages its polecats, hooks, and merge queue." },
    { icon: "🎩", title: "Mayor", desc: "The Mayor is your AI coordinator. It breaks down work into convoys, spawns agents, and orchestrates the whole system." },
    { icon: "🤖", title: "Agents", desc: "Polecats are worker agents with persistent identity. They pick up beads, implement changes, and submit to the merge queue." },
    { icon: "🚚", title: "Convoys", desc: "Convoys bundle related beads into trackable work units. They give you visibility across multiple agents working on related tasks." },
    { icon: "🔀", title: "Merge Queue", desc: "The Refinery processes completed work through a bisecting merge queue, running gates and merging to main automatically." },
  ];

  const stepCards = steps
    .map(
      (s, i) => `
    <div class="card bg-base-200 shadow-sm">
      <div class="card-body p-4">
        <div class="flex items-center gap-3">
          <span class="text-2xl">${s.icon}</span>
          <div>
            <h3 class="font-bold">Step ${i + 1}: ${s.title}</h3>
            <p class="text-sm text-base-content/70">${s.desc}</p>
          </div>
        </div>
      </div>
    </div>`
    )
    .join("");

  return `
<div class="prose max-w-3xl">
  <h1>🗺️ Guided Tour</h1>
  <p class="text-base-content/70">
    Learn the key concepts of the Gas Town dashboard. The interactive tour
    highlights each section of the UI and explains what it does.
  </p>
  <button class="btn btn-primary mb-6" onclick="window.__startTour()">
    ▶ Start Tour
  </button>
  <div class="flex flex-col gap-3">
    ${stepCards}
  </div>
</div>`;
}
