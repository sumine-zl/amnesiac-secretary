# Project: Amnesiac Secretary

## 1. Executive Summary
- Offline-first desktop password manager (Electron + browser) using a single memorized passphrase to encrypt a vault and deterministically derive site-specific passwords via WebCrypto (AES-GCM-256, PBKDF2, HKDF). No server, no cloud, no stored master password — the passphrase is never persisted and cannot be recovered.

## 2. Actors & Roles
- **User (sole role)** — owns a single encrypted vault; unlocks with a passphrase; generates secrets; manages per-service password preferences. No multi-user, no admin, no anonymous access.

## 3. Functional Requirements

### 3.1 Vault Lifecycle
- **FR-001** Create vault: User enters a passphrase (min 8 chars) and selects cipher bit length (256–4096, step 256). System generates a random cipher, IV, and salt, encrypts them with the passphrase-derived key, and stores the resulting ciphertext in localStorage.
- **FR-002** Unlock vault: User enters the passphrase. System unpacks the stored ciphertext, derives the key via PBKDF2, and attempts AES-GCM decryption. Success confirms correct passphrase; failure shows "Wrong passphrase" error.
- **FR-003** Lock vault: Clears all in-memory crypto state (cipher, key, IV, salt, payload). Returns to locked state without destroying the stored ciphertext.
- **FR-004** Delete vault: Requires the user to have exported the vault at least once in the current session. If not exported, an alert blocks deletion. Confirmation requires typing "DELETE".
- **FR-005** Change passphrase: Unlocked user provides current passphrase (verified), then a new passphrase (min 8 chars, must match confirmation). System re-encrypts the vault with the new passphrase and saves the new ciphertext.
- **FR-006** Export vault: Produces a base64-encoded ciphertext string and offers it as a file download (browser) or native Save dialog (Electron). Filename format: Vault-YYYYMMDD_HHmmss.txt.
- **FR-007** Import vault: User provides a ciphertext string via file upload (browser), native Open dialog (Electron), or pasting into a textarea. The ciphertext replaces the current localStorage value.

### 3.2 Deterministic Password Generation
- **FR-008** Generate secret: Unlocked user enters a service identity (case-sensitive, e.g. domain name), user identity (case-sensitive, e.g. username), revision number (0–15), length (8–32 chars), and strength level (6 options). System deterministically derives a password using HKDF seeded by the vault's decrypted cipher + salt + SHA-256 digests of the input identities. The same inputs always produce the same password.
- **FR-009** Strength levels define the output character set: 10 (digits only), 36 (lowercase + digits), 62 (mixed-case + digits), 91 (excludes Space, quotes, backslash), 94 (excludes Space only), 95 (all printable ASCII 32–126). Level 0 outputs raw base64.
- **FR-010** Show secret: Generated secret is displayed in a modal, hidden by default (masked). User may reveal it or copy it to clipboard. Clipboard is cleared when the modal closes.
- **FR-011** Autofill form: When the user types a service name, the system looks up saved preferences for that service and auto-populates user, revision, length, and strength.

### 3.3 Password Preferences
- **FR-012** Save preference: User saves the current generation parameters (service, user, revision, length, strength) as a preference record. Stored encrypted inside the vault payload under the "prefs" key.
- **FR-013** Update preference: If a preference for the same service+user pair already exists, the system asks for confirmation before overwriting.
- **FR-014** Forget preference: User deletes a single preference record after typing "CONFIRM".
- **FR-015** List & search preferences: Unlocked user sees all saved preferences in a searchable, sortable table (columns: Service, User, Revision, Length, Strength). Clicking a row loads its values into the generator form.
- **FR-016** Preference persistence: Preferences are re-encrypted into the vault payload on every change and persisted together with the ciphertext in localStorage.

### 3.4 Environment & Platform
- **FR-017** Browser detection: System detects whether running in a browser (local dev / GitHub Pages) vs Electron desktop. Styling and file I/O adapt accordingly (download links vs native dialogs).
- **FR-018** Demo warning: When hosted on sumine-zl.github.io, a prominent gold banner warns users to build from source for real security.
- **FR-019** Feature gating: If WebCrypto API or CompressionStream API is absent, the UI renders an unsupported-browser message and blocks all functionality.

### 3.5 Desktop Shell (Electron)
- **FR-020** Native file dialogs: Save/Open system dialogs for vault export/import via IPC context bridge. No Node.js access in renderer.
- **FR-021** Application menu: Removed entirely (no menu bar).
- **FR-022** Window: Fixed minimum size 800×736; no DevTools in production builds.

## 4. Non-Functional Requirements
- **Zero-server architecture**: All crypto operations happen client-side. No network requests for vault or password operations.
- **Passphrase irrecoverability**: The passphrase is never stored. Lost passphrase = permanent data loss. No password reset, no recovery mechanism.
- **Deterministic generation**: Same inputs (passphrase + vault + service + user + revision + length + strength) always produce the same password across sessions and platforms.
- **Adaptive key derivation**: PBKDF2 iteration count is 1,048,320 + XOR(spice) where spice is derived from the SHA-256 digest of the passphrase, making each derivation computationally unique.
- **Single-vault**: The application manages exactly one vault at a time (one ciphertext in localStorage).
- **Build artifact**: All JS/CSS/assets are inlined into a single index.html via vite-plugin-singlefile for easy distribution.

## 5. External Interfaces & Integrations
- **WebCrypto API** (window.crypto.subtle) — all encryption, decryption, hashing, and key derivation (AES-GCM-256, PBKDF2, HKDF, SHA-256).
- **CompressionStream API** (CompressionStream/DecompressionStream with deflate-raw) — payload compression before encryption.
- **File system (Electron only)** — native Save/Open dialogs via dialog.showSaveDialog / dialog.showOpenDialog over IPC.
- **localStorage** — persists the encrypted vault ciphertext string between sessions in browser mode.
- **Clipboard API** (
avigator.clipboard.writeText) — copies generated secrets; clipboard is cleared on modal close.

## 6. Technology Stack
- **Language(s):** JavaScript (ES modules, CommonJS for Electron main)
- **Framework(s):** Vue 3 (Composition API, <script setup>), Pico CSS 2
- **Database & Storage:** localStorage (browser); flat file export/import (Electron)
- **Message/Queue Systems:** None
- **Key Libraries (purpose only):** @picocss/pico (CSS framework), vite-plugin-singlefile (inline all assets into single HTML), vite-plugin-html (HTML minification), glob (build dependency)
- **Build & Test Tools:** Vite 6 (bundler), Vitest 3 + jsdom (test runner/environment), electron-builder 26 (packaging)
- **Deployment Targets:** Electron (Windows portable .exe, Linux AppImage), static web (GitHub Pages)

## 7. Configuration & Feature Flags
- ELECTRON_DEV (env var, Electron only) — when truthy, the app loads from the Vite dev server URL and opens DevTools. In production (unset), it loads the built dist/index.html and DevTools are disabled.
- process.env.ELECTRON_DEV — set automatically by electron/dev.mjs which spawns Vite then Electron with this flag.

## 8. Glossary
- **Vault**: The encrypted bundle containing the AES-GCM cipher, IV, salt, and an encrypted payload blob (compressed JSON of preferences). Serialized as base64.
- **Ciphertext**: The base64-encoded vault string that is stored in localStorage or exported to a file.
- **Payload**: An additional AES-GCM-encrypted blob within the vault that stores JSON data (currently only the prefs array). Compressed with deflate-raw before encryption.
- **Passphrase**: The user's single master secret (min 8 chars). Never stored, only used ephemerally to derive encryption keys.
- **Spice**: A single-byte XOR checksum of the passphrase's SHA-256 hash, added to the PBKDF2 iteration count to vary derivation cost per key.
- **Preferences**: Saved parameter tuples [service, user, revision, length, strength] stored inside the vault payload. Used to recall generation settings for known service+user pairs.
- **Revision**: An incrementing integer (0–15) to produce different passwords for the same service+user when a password rotation is needed.
- **Strength/Character Set**: An integer (10, 36, 62, 91, 94, 95, or 0) that selects the output character pool for generated secrets.
