# Digital Twin Platform

Architecture, product rationale, and open questions live in `Project-documentation.md` — read it first for anything beyond "how do I run this." This file is just the practical orientation for working in the repo.

## What's here today

- `apps/configurator` — Tauri v2 + React + TypeScript + Vite. The internal authoring tool: import GLBs, place them in a layout, edit parameters, (later) bind live tags and publish. Local-only for now — drafts persist to disk via `@tauri-apps/plugin-fs`, no backend yet by design (see `Project-documentation.md` §15 for when that changes).
- `packages/schema` — shared TypeScript types (`AssetDefinition`, `AssetInstance`, `ParameterBinding`, `TwinDraft`). These mirror the JSON shapes in `Project-documentation.md` §3 exactly — if you change one, change the other.
- `packages/viewer-core` — shared React Three Fiber scene renderer (`<Scene editMode>`, `<PlacedAsset>`). Built to be reused by both the configurator (edit mode) and the future client dashboard (read-only mode) — see doc §6.

Not started yet: `apps/dashboard`, `services/*` (backend, ingest, publish), `edge-gateway`. These are later roadmap items, not missing pieces of the current build.

## Commands

```
pnpm install                 # from repo root, installs the whole workspace
pnpm configurator:dev        # launches the configurator (Tauri window)
pnpm configurator:build      # production build
pnpm --filter configurator exec tsc --noEmit   # type-check only, no window (use this for quick verification)
```

## Conventions

- pnpm workspace monorepo, no Turborepo/Nx — add one only if build times actually become a problem with more packages.
- TypeScript strict mode everywhere.
- Zustand for configurator app state; every mutation goes through an owned command-stack (undo/redo + the eventual draft/publish diff), not a third-party undo library — see the plan's M3 rationale.
- `packages/viewer-core` must stay renderer-only and tenant-agnostic — no fetch/WebSocket/backend calls inside it. Data flows in as props from whichever app (configurator or dashboard) embeds it.
- Tauri v2 plugin permissions are explicit per-capability in `apps/configurator/src-tauri/capabilities/default.json` — when a new plugin API is used from the frontend, its permission has to be added there or the call fails silently at runtime.

## Verification

This is a UI-heavy app. `tsc --noEmit` and `vite build` catch type/bundle errors, but confirming a feature actually works means running `pnpm configurator:dev` and driving it by hand — see the `run` skill for this repo's exact launch sequence.
