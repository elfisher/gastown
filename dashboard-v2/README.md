# Gas Town Dashboard V2

Standalone TypeScript dashboard for Gas Town multi-agent orchestration.

## Quick Start

```bash
npm install
npm start        # http://localhost:8081
npm run dev      # with file watching
npm run build    # type-check only (tsc --noEmit)
npm test         # vitest
```

## Tech Stack

- **Fastify** — HTTP server
- **Zod** — runtime schema validation for CLI output
- **htmx** — live updates via polling
- **Tailwind CSS + DaisyUI** — dark-themed UI (CDN)
- **TypeScript** — strict mode, no `any`

## Architecture

Data comes from CLI commands (`gt`, `bd`, `tmux`), validated with Zod schemas before rendering. No Go imports, no shared code with `internal/web/`.
