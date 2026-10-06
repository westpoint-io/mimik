# Mimik

Mimik records a workflow and turns each action into a step: a screenshot, the element acted on and
a description. The guide can then be edited, replayed on a live page (Guide Me) or exported. There
are two surfaces with one codebase, a Chrome extension and an Electron desktop app for Windows and
macOS.

Everything runs on the user's machine. There is no backend, account or telemetry. AI is optional
and uses the user's own key. Never add a request that sends user data anywhere except the provider
the user chose.

## Layout

```
src/                      the extension (WXT): entrypoints, capture, blur, guideme, lib, ui, locales
packages/core/src/        logic both surfaces share: capture, guides, export, screenshot, blur, i18n
packages/ui/src/          React both surfaces share, grouped by feature
packages/capture-native/  Rust napi addon: accessibility lookup and input hook, Windows and macOS
apps/desktop/src/         Electron: main, preload, renderer
scripts/                  repository checks run by pnpm lint
```

Each of these has its own `AGENTS.md`. Read it before working there.

## Commands

```
pnpm dev                     extension, hot reload (pnpm dev:firefox for Firefox)
pnpm build                   extension build
pnpm dev:desktop             desktop app
pnpm pack:desktop            unpacked desktop app in apps/desktop/dist
pnpm test                    vitest, all packages
pnpm lint                    biome, then the one-export-per-file check
pnpm typecheck               root and desktop
pnpm --filter @mimik/desktop check:pipeline   also check:storage, check:overlay, check:capture
pnpm --filter @mimik/capture-native build
```

Before calling work done, run lint, typecheck and test. If you touched `apps/desktop` or desktop
capture code in core, also run the desktop checks (under `xvfb-run` on Linux).

## Rules

- **`packages/` belongs to both surfaces.** It never imports from an app (`@/lib`, `@/ui`,
  `@/entrypoints`, `#imports`, `apps/`). Biome enforces this. If you have to ask which surface owns
  a file there, it belongs in that app instead.
- **Behaviour that differs by surface:** shared code that decides for itself asks `client()` from
  core. Behaviour only the app can supply comes in as a prop.
- **Reuse the extension.** A feature both surfaces have uses the extension's component, wording
  and placement, and the desktop gets every branch of it, not a subset.
- **Same names for the same thing on both surfaces:**
  - the capture states and events from core's machine;
  - `isLive`;
  - message and IPC names (`captureStep`, `createGuide`, `deleteStep`, `getState`);
  - the insert fields (`insertTargetGuideId`, `insertAtIndex`);
  - the narration phases (`VoicePhase`).
  Different code is fine where the platforms differ; different words for the same concept are not.
- **One export per file**, named, with the file named after it. A component file has no helpers. A
  hook or a `lib/` function may keep one private helper. There are no default exports except where
  a framework reads them, and no re-exports outside `packages/ui/src/index.ts`. The second half of
  `pnpm lint` checks all of this.
- **Imports from `@mimik/ui`:** apps import from its entry only, plus `@mimik/ui/env`,
  `@mimik/ui/global.css` and `@mimik/ui/common/lib/mascot-shapes`. Inside the package, imports are
  relative.
- **No comments in source**, except pragmas and directives the toolchain reads.
- **Every user-facing string goes through i18n** and gets a translation in every file under
  `src/locales/`.
- **Colours:** the interface is navy and lavender, with tokens in `packages/ui/src/global.css`. The
  indigo `#4F46E5` is only for marks drawn over other people's pixels and for the mascot.
- **Baseline snapshots** (`blur-baseline`, `naming-baseline`) pin what Smart Blur hides and how
  steps are named. Re-record them with `vitest -u` only for a deliberate change in behaviour.
- **Privacy invariants:**
  - A narration transcript never goes into an export or a `.mimik` file.
  - A password value is never read or stored.
  - A screenshot leaving the app goes through the renderer, so blur is burned in.

## Intentional differences

These are platform differences, not drift. Do not "fix" them:

- **Starting:** the desktop has an `ARMED` state (the card waits for Start), capture modes and an
  area editor. The extension starts recording at once in the current tab.
- **Where state lives:** the extension's background worker is evicted when idle, so its machine is
  saved to `sessionStorage`. The desktop's main process is never evicted.
- **Messages:** the extension has tab, URL, blur and Guide Me messages. The desktop has none of these.
- **Writing steps:** the extension's worker writes them. On the desktop, main asks the renderer to
  write them, because IndexedDB lives in the renderer.
- **Typing:** the extension writes a typing step on the first key and updates it. The desktop writes
  it once, when typing stops.
- **Screenshots:** stored as a `Blob` in the extension and as a PNG file with a `src` on the desktop.
- **Fallback titles:** "Guide on <site>" in the extension, "Guide in <app>" on the desktop.
- **Extension only:** Smart Blur and Guide Me need a live page.
- **Settings:** `recordKeys` is a core setting in the extension and lives in `capture-settings.json`
  on the desktop, because the desktop's main process reads it.
- **Live updates:** the card hears about step changes from main. The side panel re-reads the database.

## Commits and PRs

- Conventional commits, subject line only, no body.
- The human contributor authors commits. Never set an AI as the author and never add
  `Co-Authored-By`, `Assisted-by`, `Generated-by` or session-link trailers. AI use is disclosed only
  on the PR template's "AI model(s) used" line.
- PR descriptions are short prose, written by you. See `CONTRIBUTING.md`, "Using AI Tools".
- Never name another product or company in code, commits, PRs or docs.
