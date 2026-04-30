# Amnesiac Secretary — Agent Instructions

## Stack
- **Vue 3** (Composition API, `<script setup>`) + **Pico CSS 2**
- **Vite 6** — dev/build, **Vitest 3** — tests, **jsdom** test env
- Single package, not a monorepo

## Commands
| Action | Command |
|---|---|
| Dev server | `npm run dev` |
| Build | `npm run build` → `dist/` |
| Preview build | `npm run preview` |
| Run all tests | `npm test` (vitest, verbose reporter) |
| Run one test file | `npx vitest src/lib/Secretary.test.js` |

No lint or typecheck scripts configured.

## Build quirks
- `vite-plugin-singlefile` — **build produces a single self-contained `dist/index.html`** with all JS/CSS/assets inlined. The `dist/` folder also contains `favicon.ico`.
- Base URL is `/as/` (vite config).
- Public directory: `pub/`. Assets directory: `res/`.
- `@` path alias → `./src/*` (configured in `vite.config.js` and `jsconfig.json`).

## Entrypoint
`src/index.js` → mounts `IndexApp.vue` to `#app`. Core crypto logic in `src/lib/Secretary.js` + `src/lib/Util.js`.

## Tests
- Co-located with source: `src/lib/*.test.js`
- Require jsdom's `window.crypto.subtle` + `CompressionStream/DecompressionStream` (native browser APIs, jsdom provides minimal polyfills).
- `Uint8Array(...)` wrappers on `subtle` inputs are intentional (test compatibility) — preserve them.
- 15s per-test timeout; some tests are async and CPU-heavy (PBKDF2 iterations).

## Architecture
- Client-only SPA. No server, no build-time codegen, no database.
- Password manager using WebCrypto (AES-GCM-256, PBKDF2, HKDF, SHA-256).
- Ciphertext embeds preferences via `sba4Pack` binary format + deflate-raw compression.
- Only directory with meaningful code: `src/` — everything else is config, docs, or build output.
