# Contributing

## Development

1. Install dependencies with `npm install`.
2. Start the desktop app with `npm run tauri dev`.
3. Run frontend checks with `npm run build` and `npm test`.
4. Run backend checks from `src-tauri/` with `cargo test`.

## Expectations

- Keep Git operations safe by default, especially destructive actions.
- Add or update tests when changing parsing, persistence, or command execution logic.
- Prefer structured UI over raw command output when exposing new Git features.
