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
- commit graph with SVG lanes, filters, ref visibility, interactive rebase, reflog recovery, and virtualized scrolling
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

- Node.js 18+
- npm
- Rust toolchain
- system dependencies required by Tauri/WebKitGTK on Linux
- Git installed and available on `PATH`

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
cargo check
npx tsc --noEmit
npm run build
```

## Notes

- The commit graph now uses virtualized scrolling for large histories.
- Diff highlighting is powered by Shiki, which increases frontend bundle size during production builds.
- Packaging targets and system integration artifacts are still tracked separately.
