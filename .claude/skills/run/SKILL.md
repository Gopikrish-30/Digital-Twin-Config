---
name: run
description: Launch and drive the Digital Twin configurator (Tauri desktop app) for this repo.
---

# Running the configurator

This repo's only runnable app right now is `apps/configurator` (Tauri v2 + React + Vite). There is no dashboard app and no backend yet — see `CLAUDE.md` and `Project-documentation.md` for why.

## Launch

From the repo root:

```
pnpm configurator:dev
```

This runs `tauri dev` for the `configurator` package — it starts the Vite dev server and opens a native desktop window (WebView2 on Windows). It's a long-lived, blocking process with a real GUI window: run it with `run_in_background: true` (Bash) or open it in a terminal the user can see, never as a foreground blocking call. There is no headless/browser preview — Tauri opens an actual OS window.

## Fast verification without a window

Before or instead of launching the full window, these confirm the app is in a working state and are safe to run in the foreground:

```
pnpm --filter configurator exec tsc --noEmit   # type errors
pnpm --filter configurator exec vite build     # frontend bundles cleanly
cd apps/configurator/src-tauri && cargo check  # Rust backend compiles (slow on first run, ~4 min; fast after)
```

Use these after any change before claiming something works — `tsc`/`vite build` catch real breakage fast; only fire up the actual window (via Monitor/background Bash) when you need to see rendered output or drive an interaction a type-check can't verify (e.g. "does the gizmo actually appear when I select an instance").

## What "working" looks like right now

The window should open to a full-viewport 3D scene: a ground grid, orbit-controllable camera, and one placeholder blue box (this is the M1 smoke test from the build plan, not a real asset yet — see `packages/viewer-core/src/Scene.tsx`). If GLB-backed assets have been wired in since, expect those instead of the box.

## If it won't build

- `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` → a workspace package (`@digital-twin/schema` or `@digital-twin/viewer-core`) is referenced but missing/renamed; check `pnpm-workspace.yaml` and the package's own `package.json` `name` field match.
- A Tauri plugin API works in code but does nothing / throws at runtime → its permission is very likely missing from `apps/configurator/src-tauri/capabilities/default.json`. Tauri v2 permissions are allow-listed per capability, not implied by the Cargo dependency.
