# GitPulse

Desktop Git client built with Tauri v2, React, and Vite.

## Current Scope

GitPulse currently includes:

- repository and multi-repository workspace loading, including recent repository reopen
- source control with staged/unstaged sections
- file diffing with split and inline modes, whitespace controls, binary/image previews, and word-level highlighting
- line and hunk stage, unstage, and discard actions
- Shiki-based diff syntax highlighting
- commit creation, amend, undo, commit identities, signing, and staged-change prompts
- branch management, upstream controls, compare view, publishing, and branch picker
- commit graph with SVG lanes, filters, ref visibility, interactive rebase, reflog recovery, merge-commit parent picker, and virtualized scrolling
- blame view
- file history view
- stash management with filtering
- worktree management
- merge conflict inspection and resolution flow
- fetch, pull, push, sync, auto-fetch, progress reporting, and sync confirmation
- remotes, tags, submodules, sparse checkout, LFS, hooks, patches, and timeline tools
- settings persistence for theme, auto-fetch, external editor, identities, and sync behavior

## Stack

- frontend: React 18, Zustand, `@tanstack/react-virtual`, Shiki
- desktop shell: Tauri v2
- backend: Rust

## Requirements

- Node.js (see `.nvmrc`; currently v26.1.0)
- npm
- Rust toolchain
- system dependencies required by Tauri/WebKitGTK on Linux
- Git installed and available on `PATH`

## Project Layout

- `src/` — React frontend (components, hooks, Zustand stores, types, styles)
- `src-tauri/` — Rust backend (Tauri commands, Git runners and parsers, workspace and config)
- `vite.config.ts`, `tsconfig*.json` — frontend build configuration
- `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json` — backend and desktop shell configuration

## Development

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the Tauri app:

```bash
npm run tauri dev
```

Build the frontend bundle:

```bash
npm run build
```

Build the desktop app with Tauri:

```bash
npm run tauri build
```

## Validation

The project is currently verified with:

```bash
cargo check                          # backend type check
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests (Git parsers, runner)
npx tsc --noEmit                     # frontend type check
npm test                             # vitest suite
npm run build                        # production frontend bundle
```

## Smoke Test on a Large Repository

Performance regressions tend to surface only on big histories. Before tagging a release, exercise the app against a deep repository (the Linux kernel works well):

```bash
git clone --filter=blob:none https://github.com/torvalds/linux.git ~/scratch/linux
npm run tauri dev
```

Then open the cloned repo and check:

- the commit graph scrolls smoothly past 100k commits and lanes stay aligned
- blame on `kernel/sched/core.c` (or any large, frequently edited file) returns within a few seconds and the gutter stays responsive on scroll
- file history on a long-lived file paginates without blocking
- a full status pass on the dirty working tree returns under a second
- searching/filtering the graph by author/ref does not freeze the UI

If any of these stall the UI for more than a beat, that's a regression to fix before release.

## Notes

- The commit graph now uses virtualized scrolling for large histories.
- Diff highlighting is powered by Shiki, which increases frontend bundle size during production builds.
- Packaging targets and system integration artifacts are still tracked separately.
