# Mimik

Open-source Chrome extension that auto-captures browser workflows and generates step-by-step guides. No backend, no account, no data leaves the browser.

## What It Does

You click "Record," perform a workflow in your browser, and Mimik automatically captures each action as a step with an annotated screenshot and description. You can edit the guide, replay it on a live page, or export it as a file.

**Core loop: Record → Edit → Replay or Export.**

## Architecture

**Everything runs in the Chrome extension. No backend.**

- Storage: IndexedDB via Dexie.js (browser-local)
- AI descriptions: optional, user provides their own API key in settings
- Export: generated client-side (no server rendering)
- No auth, no database, no hosting, no Docker

### Directory Structure

```
src/
├── core/                    # Business logic (no UI dependencies)
│   ├── capture/             # Recording pipeline
│   │   ├── ai/              # AI description + title generation (Vercel AI SDK)
│   │   │   ├── description.ts   # getAIDescription (DOM context → AI → step text)
│   │   │   ├── title.ts         # generateGuideTitle (steps → AI → guide name)
│   │   │   ├── models.ts        # AI_PROVIDERS config (OpenAI/Anthropic model lists)
│   │   │   ├── prompts.ts       # Prompt templates
│   │   │   └── provider.ts      # createModel factory (OpenAI/Anthropic)
│   │   ├── dom/              # DOM extraction utilities
│   │   │   ├── context.ts       # DOMContext extraction + serialization
│   │   │   ├── element-meta.ts  # extractElementMeta (selector, text, aria, rect)
│   │   │   └── element-utils.ts # findFocusableAncestor, isTextField, etc.
│   │   ├── events/           # Event capture system
│   │   │   ├── handlers.ts      # CaptureController class + startCapture
│   │   │   └── input-session.ts # InputSession (typing lifecycle)
│   │   ├── machine.ts        # xstate capture state machine
│   │   ├── session.ts        # CaptureSession (lifecycle manager)
│   │   ├── spa-nav.ts        # SPA navigation tracking
│   │   ├── start-notification.ts # Recording notification overlay
│   │   └── step-description.ts   # Fallback rule-based descriptions
│   ├── blur/                # Smart blur: regex presets, DOM scanner, element picker, panel UI
│   ├── export/              # HTML, PDF, DOCX, Markdown, video generators + shared utils
│   └── guides/              # Data layer: types, Dexie DB, CRUD service
├── entrypoints/             # Chrome extension entry points (WXT)
│   ├── background/          # Service worker: state machine, message handlers, tab management
│   ├── content.ts           # Content script: CaptureSession, event listeners
│   ├── sidepanel/           # Side panel React mount
│   ├── fullview/            # Full-page view React mount
│   ├── onboarding/          # Onboarding wizard (opens on first install)
│   └── options/             # Settings page React mount
├── lib/                     # Shared utilities
│   ├── messaging.ts         # Extension messaging protocol (webext-core)
│   ├── port.ts              # Long-lived port: background ↔ sidepanel
│   ├── browser-api.ts       # Chrome API wrappers
│   ├── tab-messages.ts      # Content script message types
│   ├── logger.ts            # Logging utility
│   └── utils.ts             # Shared helpers (dates, URLs, cn)
├── stores/                  # Zustand state stores
│   └── fullview.ts          # Fullview UI state (search, counts, guide data)
└── ui/                      # React components
    ├── components/ui/       # shadcn/ui primitives (button, input, dialog, badge)
    ├── fullview/            # Full-page dashboard
    │   ├── components/      # Extracted sub-components (grid, list, search, etc.)
    │   ├── App.tsx
    │   ├── TopNav.tsx
    │   ├── SearchModal.tsx
    │   ├── GuideContent.tsx
    │   ├── LibraryContent.tsx
    │   └── router.ts
    ├── sidepanel/           # Side panel UI
    │   ├── App.tsx
    │   ├── LibraryView.tsx
    │   ├── GuideEditor.tsx
    │   ├── RecordingView.tsx
    │   ├── StepCard.tsx
    │   ├── ExportMenu.tsx
    │   ├── BlurCanvas.tsx
    │   └── ZoomScreenshot.tsx
    ├── onboarding/          # Onboarding wizard UI
    │   └── App.tsx          # 5-step wizard (welcome, AI, blur, pin, done)
    ├── shared/              # Shared UI components
    │   └── SettingsView.tsx  # AI settings (provider, model, API key)
    └── options/             # Settings page
        └── App.tsx
```

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Capture lifecycle | xstate | State machine (IDLE ↔ RECORDING) in background service worker |
| Fullview UI | Zustand | Search modal, guide counts, active guide data |
| Persistence | Dexie (IndexedDB) | Guides, steps, screenshots, snapshots |
| Service worker recovery | sessionStorage | xstate machine snapshot persistence |
| Background → Sidepanel | Port messaging | Real-time state broadcast |
| Cross-context sync | BroadcastChannel | Guide mutations (star, delete) across sidepanel/fullview |

## Extension Entry Points

| Entry Point | File | Purpose |
|-------------|------|---------|
| Background | `entrypoints/background/` | Service worker: xstate actor, message handlers, tab management |
| Content Script | `entrypoints/content.ts` | Injected into all tabs: CaptureSession, event listeners |
| Side Panel | `entrypoints/sidepanel/` | Recording controls, library, guide editor, settings |
| Full View | `entrypoints/fullview/` | Dashboard: library browse, guide viewer, Ctrl+K search |
| Onboarding | `entrypoints/onboarding/` | First-install wizard: AI setup, smart blur, pin extension |
| Options | `entrypoints/options/` | Settings page (shared SettingsView in centered card) |

## Messaging

```
Content Script ←→ Background Service Worker ←→ Sidepanel / Fullview
```

**Extension messages** (webext-core, `lib/messaging.ts`):
- `getState` → current capture state, step count, guide ID
- `startRecording({url})` → creates guide, returns guideId
- `stopRecording()` → finalizes guide, generates AI title
- `captureStep({guideId, action, elementMeta, domContext})` → screenshots + creates step
- `updateInputStep({stepId, description})` → updates typing step description
- `finalizeInputStep({stepId, elementMeta, domContext})` → final screenshot + AI description

**Tab messages** (content script ↔ background, `lib/tab-messages.ts`):
- `PING` / `START_CAPTURE` / `STOP_CAPTURE` — lifecycle
- `SHOW_NOTIFICATION` — "Recording started" overlay
- `URL_CHANGED` / `GET_ROUTE` — SPA navigation tracking

## Capture Pipeline

**Start recording:**
1. User clicks "Start Capture" in sidepanel
2. Background transitions xstate machine IDLE → RECORDING
3. Creates Guide in IndexedDB, broadcasts `START_CAPTURE` to all tabs
4. Content scripts create CaptureSession → CaptureController (event listeners)
5. Shows recording notification overlay on active tab

**Capture a click:**
1. Content script's CaptureController detects click via DOM event listener
2. Click handler pushes async work into PQueue (concurrency: 1)
3. Enqueueing hides the hover ring (`pointerdown` already did, on mouse paths); queue waits 3 frames then sends `captureStep`
4. Background calls `captureVisibleTab` (ring is hidden, page hasn't reacted yet)
5. Saves Screenshot + Step to IndexedDB
6. Queues the AI description from DOM context text (serialized in the background; the step carries `aiPending` until it lands) rather than awaiting it
7. Returns `{ stepId }` → queue processes next event; the ring returns only once the queue is fully drained

**Capture text input (typing):**
1. Click on text field → CaptureController starts InputSession → `captureStep` with initial screenshot
2. Each keystroke → InputSession.update() → `updateInputStep` (description only, fire-and-forget)
3. Enter/Escape/focusout → InputSession.finalize() → `finalizeInputStep` → final screenshot replaces initial + queued AI description
4. Result: one step for entire typing interaction

**Stop recording:**
1. Background transitions RECORDING → IDLE
2. Broadcasts `STOP_CAPTURE`, content scripts flush pending input sessions
3. Background drains queued step descriptions (20s cap), then generates the guide title from step descriptions + URLs via AI
4. Opens fullview dashboard with the guide

## DOM Context (AI Input)

Instead of sending screenshots to the AI for step descriptions, Mimik extracts a lightweight DOM context (~50-100 tokens) from around the target element:

```
Page: "Public profile - Settings" /settings/profile
Container: form "Public profile"
Heading: "Public profile"
Siblings: input "Name", input "Email", textarea "Bio", button "Update profile"
→ Target: button "Update profile" (click)
```

Extraction walks up from the target element to find:
- Page title + URL path
- Nearest semantic container (form, nav, dialog, section) or 3 levels up
- Nearest heading
- Sibling interactive elements in the same container (max 10)

## Element Metadata

`ElementMeta` describes the thing the user acted on, and it is written by more than one kind of
capture. `source` says which — `dom` in the extension, `ax` on macOS, `uia` on Windows. It is absent
on records captured before the field existed, so read it through `elementSource(meta)`, which
defaults to `dom`.

The identity fields are shared, and every source populates them:

| Field | DOM | macOS AX | Windows UIAutomation |
|---|---|---|---|
| `role` | `role` attribute, else tag name | `AXRole` | `ControlType` |
| `name` | `name` attribute | `AXIdentifier` | `AutomationId` |
| `textContent` | trimmed text | `AXValue` / `AXSelectedText` | `Value` |
| `ariaLabel` | `aria-label` | `AXTitle` / `AXDescription` | `Name` |
| `placeholder` | `placeholder` | `AXPlaceholderValue` | — |
| `altText` | `img.alt` | `AXHelp` | `HelpText` |
| `rect` | `getBoundingClientRect()` | `AXPosition` + `AXSize` | `BoundingRectangle` |

The mapping is chosen so the shared precedence in `buildFallbackDescription` — `ariaLabel`,
`placeholder`, `textContent`, `altText`, `name`, `role` — picks the right string without anyone
branching on `source`. That is why the accessible name lands in `ariaLabel` rather than `name`:
`name` sits near the bottom of that list, and a control's accessible name should beat its value.
`name` therefore holds the stable machine identifier instead, which is what a future desktop replay
will want. UIAutomation has no placeholder property in the API surface we bind, so that field stays
null there.

A fourth source, `screen`, knows only where the click landed: it fills `rect` with a fixed box around
the click point, `clickPoint`, `devicePixelRatio`, `app` and `window`, and leaves every identity field
null.

`tag`, `cssSelector`, `href` and `dataTestId` are DOM-only and absent elsewhere. `app` and `window`
are the reverse — desktop only. `inputType` is mostly DOM-only, but a desktop typing step sets it to
`password` when the field says so, because that is the one input type a screen capture can learn.

Guide Me is the one place a `source` check is correct, through `isReplayable`. It replays against a
live DOM, so a step is replayable only when its source is `dom` — or absent, which means it predates
the field and was therefore a DOM capture. The old test was "does the step have an `elementMeta` at
all", which was true before desktop existed and is now true of every desktop step; it left a Guide
Me button on guides that can never be replayed. The button is not rendered at all when nothing is
replayable, rather than rendered disabled, because on desktop it could never become enabled.

Consumers must not branch on `source`. Read the shared fields first and treat the DOM-only ones as
refinements: `buildFallbackDescription` reaches the same wording through `role === 'checkbox'` that
it reaches through `tag === 'input' && inputType === 'checkbox'`. Guide Me is the exception by
nature — it replays against a live DOM, so `finder.ts` scores `cssSelector` only when present and
falls back to `*` without a tag.

## Desktop Shell

`apps/desktop` is an Electron app that consumes `@mimik/core` the same way the extension does.

| Piece | File | Purpose |
|---|---|---|
| Main | `src/main/index.ts` | Window, tray, single-instance lock, start-at-login |
| Updater | `src/main/updater.ts` | `electron-updater`, only ever runs when `app.isPackaged` |
| Preload | `src/preload/index.ts` | `window.mimik` over `contextBridge`, context isolation on |
| Renderer | `src/renderer/` | Vite app; aliases `@mimik/core` at the package source |

Electron rather than Tauri because `core/export/video-export.ts` needs WebCodecs, which is
unreliable in the system webviews Tauri uses — WebKitGTK in particular.

Closing the window hides it; the app keeps running in the tray and only exits through Quit or
`before-quit`. Start-at-login is stored by the OS via `app.setLoginItemSettings`, so there is no
settings file to keep in sync, and `openAsHidden` pairs with the `wasOpenedAsHidden` check in
`ready-to-show` so a login launch does not steal focus.

`pnpm dev:desktop` runs it, `pnpm build:desktop` compiles, `pnpm pack:desktop` produces an unpacked
app in `apps/desktop/dist`. `electron-builder.yml` targets dmg/zip, nsis and AppImage/deb, and
`executableName` must stay set or the binary inherits the scoped package name.

## Desktop Capture Primitives

`apps/desktop/src/main/capture` holds the five things a desktop capture needs. One comes from
Electron, three are prebuilt npm packages, and only the last is a crate we maintain.

| Primitive | Source | Native |
|---|---|---|
| Displays, DPI, cursor | Electron `screen` | no |
| Screenshot of a display | `node-screenshots` | prebuilt |
| Focused foreign window | `get-windows` | prebuilt |
| Global clicks and keys | `uiohook-napi` | prebuilt |
| Control under a point | `@mimik/capture-native` | ours |

Screenshots do not go through Electron's `desktopCapturer`. That route asks the xdg desktop portal
on Wayland and fails outright when the portal does not answer, and it was returning frames that
decoded to nothing on Windows. `node-screenshots` talks to each platform's own capture API, so it
has a Wayland path and needs no portal. Monitor identifiers there have nothing to do with Electron
display ids, so the monitor is resolved from a point inside the display's bounds rather than matched
by id.

Anything richer than these four — the accessibility tree in particular — has no prebuilt package
worth taking, so it is an addon of our own in `packages/capture-native`.

**On Linux, input and window lookup are X11 only; screenshots are not.** `uiohook-napi` links
`libX11`/`libXtst` and hooks through `XRecord`, with no Wayland path; on a Wayland session the hook
starts and then silently delivers nothing. `get-windows` shells out to `xwininfo`, also X11. Both are
gated on `XDG_SESSION_TYPE` and refuse up front with `reason: 'unsupported-session'` rather than
appearing to work. Screenshots work on both, so a Wayland machine can still exercise the capture and
export path even though it cannot record clicks. Linux also needs `xwininfo` and `xprop` on `PATH`.
macOS and Windows are unaffected.

`pnpm --filter @mimik/desktop check:capture` builds and exercises every primitive, printing `ok`,
`n/a` for a platform limit, or `FAIL`. Only `FAIL` sets a non-zero exit, so the check is meaningful
on a machine where half the primitives cannot work.

## Desktop Accessibility Addon

`packages/capture-native` is a napi-rs addon exposing one thing: `elementAtPoint(x, y)`, the
accessibility metadata for whatever control sits under a screen point. Nothing else belongs in it.
Displays, screenshots, window lookup and the input hook are all covered by prebuilt npm packages
already, and the accessibility tree is the only primitive with no usable package behind it — the
candidates on npm either ship no prebuilt binaries at all, bind the wrong API, or are unmaintained,
and an addon compiled from source at install time would need a full C++ toolchain on every user's
machine.

Rust rather than C++ because `node-gyp` cannot cross-compile and `cargo` can. `pnpm --filter
@mimik/capture-native build:windows` produces `capture-native.win32-x64-msvc.node` on a Linux
machine through `cargo-xwin`, which downloads the Windows SDK headers and import libraries itself.

Windows only. `is_supported()` answers false everywhere else and `elementAtPoint` resolves to null,
so the app, the checks and the recording pipeline all behave the same as when the binary is simply
missing. macOS is the same shape of work against `AXUIElementCopyAttributeValue` and is not done.

The implementation is `IUIAutomation::ElementFromPoint` and six property reads. COM is initialised
multi-threaded once per worker thread and the `IUIAutomation` instance is cached in a thread local,
because the call runs on the libuv threadpool through `AsyncTask` rather than on the main thread —
a cross-process UIAutomation call against a busy application blocks for as long as that application
takes to answer, and blocking Electron's main thread there would freeze the overlay mid-recording.
Rectangles come back in physical pixels, so the caller converts the point with `dipToScreenPoint` on
the way in and the rectangle with `screenToDipRect` on the way out, the same convention
`focusedWindow` follows.

`ControlType` is translated to the ARIA-ish role vocabulary the rest of the app already speaks, so
`role === 'checkbox'` means the same thing whether it came from a DOM attribute or from
`UIA_CheckBoxControlTypeId`. An unmapped control type yields a null role rather than an invented
name.

`focusedElement()` is the second call. The remaining three — `keyLabel`, `resolveKey` and
`resetDeadKeyState` — are the keyboard, and unlike the first two they are synchronous, because
resolving a scancode against a keyboard layout is a local call with nothing to wait on. It reports `isPassword` alongside the usual fields, and the value is discarded at the
addon boundary when that flag is set, so a password never reaches our data even though UIAutomation
already withholds it.

## Overlays We Put In The Page

Five things draw into a page someone else owns: the hover ring, the blur picker, the blur panel, the
Guide Me overlay and the recording notification. All five are the same construction — an element
carrying `data-mimik-ignore` with a closed shadow root and one `<style>` — and `createOverlayRoot`
builds it.

Both attributes are load-bearing and neither fails loudly. Without `data-mimik-ignore` the overlay
becomes a capture target and a blur candidate, so recording the page records our own chrome; with an
open shadow root the page's CSS reaches in and restyles it. Five hand-written copies meant five
chances to forget one, and three of the five had no test at all. One function has one test, and it
asserts both invariants by construction: a closed root reads back as `null` through `host.shadowRoot`,
which is the assertion for `mode: 'closed'`.

Reading the attribute back is `isMimikElement`, in `capture/dom/element-utils.ts`. The blur picker
had grown a private copy of it, identical line for line.

## Boundaries The Linter Holds

`biome.json` covers `src`, `packages/core`, `packages/ui` and `apps/desktop`. `packages/ui` was
missing from that list for a long time and nobody noticed, which is how forty-odd files reached it
unchecked; adding it produced forty-one fixes on the first run.

A `noRestrictedImports` override forbids anything under `packages/**` from importing `@/lib/*`,
`@/ui/*`, `@/entrypoints/*`, `#imports` or any path through `apps/`. Shared code may never depend on
an app. It is the rule that keeps `packages/ui` genuinely shared rather than quietly coupled to one
surface, and it is also the licence seam: an MIT package that imports from a copyleft app is no
longer MIT.

One boundary the linter does **not** hold, and it bites: main-process code may only take `type`
imports from `@mimik/core`. The renderer aliases the package to its source and bundles it, while
`electron-vite`'s `externalizeDepsPlugin` leaves it external in main, so a value import resolves at
runtime to a path with no file and the app dies on launch with `ERR_MODULE_NOT_FOUND`. That is why
`capture/screenshot.ts` keeps its own three-line `clamp` rather than importing core's: deduplicating
a one-liner is not worth a cross-boundary dependency that does not work.

## UI Package Layout

`packages/ui/src` is grouped by feature, not by the surface that first used a file: `ai`,
`annotation`, `common`, `export`, `guide`, `history`, `library`, `navigation` and `search`. Inside a
feature, components sit in `components/`, hooks in `hooks/`, plain functions in `lib/`, a store
slice in `store/`, and a `types.ts` only when several files share a type. `components/ui` holds the
shadcn primitives as the generator writes them, and `stores/` merges the slices.

A file exports one thing — a component, a hook or a function — and is named after it. A hook or a
`lib/` function may keep one private helper that nothing else calls; a component file keeps none, so
its helpers live in the feature's `lib/`. Constants and types may sit beside the export they serve.

The apps import from `'@mimik/ui'` and nowhere deeper, except `@mimik/ui/env` and
`@mimik/ui/global.css`. `src/index.ts` is the one file allowed to re-export, and code inside the
package never imports through it — that would be a cycle. Adding a public component means adding a
line there. The extension build was diffed against the pre-entry baseline: the service worker and
the content script came out byte-identical, because neither imports the package, and the rest moved
by a few hundred bytes.

The linter holds all of it. `noRestrictedImports` rejects a deep `@mimik/ui/*` import from the apps
and a bare `'@mimik/ui'` from anything under `packages/`. `noBarrelFile` rejects any other
re-exporting file, and `useComponentExportOnlyModules` rejects a component file that also exports a
function or a hook. The shadcn primitives are excused from the last rule, since they export their
`*Variants` beside the component and regenerating them would bring that back. Nothing checks
that a `lib/` file holds one function; that part is review.

Three things break quietly when files move here. The root `tsconfig.json` declares its own `paths`,
which replace the ones in `.wxt/tsconfig.json` rather than extending them, so the bare `@mimik/ui`
entry has to be listed in the root config and in `apps/desktop/tsconfig.json` alike. A `vi.mock`
path is a string the refactoring tools do not rewrite, and a stale one mocks nothing without
failing. And `sideEffects` in the package's `package.json` names `common/lib/dayjs-locale.ts`,
because that file registers the dayjs locales by importing them; renaming it without updating
the entry lets a bundler drop the translations.

## Which Client Is Running

`configureCore` carries a `client`, `extension` or `desktop`, and `client()` reads it back. Shared
code that must genuinely behave differently asks at runtime rather than taking a prop for it, which
is how the surfaces stay one codebase instead of two dressed as one.

The distinction worth holding: a **prop** is right when the app supplies behaviour the shared code
could not know — `onStartCapture` opens a capture sheet on one surface and a side panel on the
other, and neither belongs in `packages/ui`. `client()` is right when shared code decides for
itself, with nothing to pass down.

The rule that keeps `packages/ui` from becoming a filing problem is simpler than a taxonomy:
anything in it belongs to **both** surfaces. Asking which surface owns a file there means it is in
the wrong place, and it should live in `apps/desktop` or in the extension's `src/ui`. That is why
`CaptureSheet`, the capture settings and the overlay have never been shared — they are not shared
components filed badly, they are the parts of the desktop that have no counterpart at all.

## Desktop Storage

The desktop app reuses `@mimik/core/guides` for everything except the screenshot bytes — Electron's
Chromium provides IndexedDB, so `MimikDB`, the service layer and the Dexie migrations all carry over
with no rewrite. A screenshot row holds a `src` instead of a `blob` when the bytes live on disk, and
the service hydrates one into the other on read, so the distinction stops at the storage layer.
`MimikDB` takes an optional database name so a check can open a throwaway store instead of the
user's `mimik` one.

Core reaches the surface through `configureCore`, so every desktop entry point imports
`src/renderer/core-env.ts` for its side effect, exactly as the extension imports `src/lib/core-env.ts`.
The desktop adapter backs settings with `window.localStorage` and returns message keys verbatim —
desktop strings land with the desktop UI.

`pnpm --filter @mimik/desktop check:storage` runs four checks across two hidden `BrowserWindow`s:
the v1 to v2 upgrade against a real v1 store, `MimikDB` opening at v2 with all four tables, a guide
written through the core service, and that same guide read back from a second renderer process with
its screenshot `Blob` intact. Results come back over a tagged `console-message` rather than IPC, so
the check windows need no `nodeIntegration` and no production preload channel. `window-all-closed`
is a no-op there, or destroying the first window would quit the app before the second one ran.

Two surfaces sharing a guide means two windows of the same app. The extension and the desktop app
are separate origins with separate stores; moving a guide between them is the portable format's job.

## Capture Area and Controls

The capture region is a screen-coordinate rectangle that survives restarts in
`capture-region.json` under `app.getPath('userData')`. `clampToDisplays` runs on every load and save,
so a region stored against a monitor that is no longer attached lands back inside a real work area
instead of off-screen, and nothing smaller than 240 × 160 is storable.

`CaptureOverlay` owns three kinds of window, all frameless, transparent and `alwaysOnTop` at
`screen-saver` level. The controls are a card docked to the bottom-right of the work area, not a bar
across the middle of the screen, because the middle is where the work being recorded happens:

| Window | When | Input |
|---|---|---|
| Editor, one per display | `editing` | interactive — drag to draw, move or resize |
| Boundary, sized to the region | `armed`, `recording`, `paused`, `region` mode only | click-through |
| Controls bar | `armed`, `recording`, `paused` | interactive |

The boundary only exists in `region` mode, because the other two modes have no fixed rectangle to
draw. `overlay.ignores(point)` keeps clicks on the card from becoming steps — without it, pressing
Pause in whole-screen mode would capture pressing Pause.

The card carries what the extension's recording view carries, shrunk to sit over someone else's work:
state, step count, the screenshot just taken, its title, and two actions. Showing the capture is the
point — it is the only way to tell mid-recording that a step landed on the right thing, and without it
a wrong capture mode is discovered after twenty steps rather than after one. Main already holds that
screenshot's URL when it tells the overlay a step was captured, so the card reads it over the same
`mimik-screenshot://` scheme the app window uses and no image data crosses IPC.

All three roles are one HTML file and one stylesheet, told apart only by `body.editor`,
`body.boundary` and `body.controls`, so an id is shared across three documents. The card's rules are
scoped under `body.controls` for that reason: an unscoped `#hint` already existed for the region
editor, absolutely positioned and dark, and it silently captured the card's hint the first time both
used the name. `check:overlay` asserts the card's hint computes to `position: static`, which is the
cheapest way to catch the next collision.

The card sizes itself. The renderer reports `scrollHeight` after every render and main moves the
window to match, so a long step title or a collapse does not need a table of per-state pixel heights.
That only works because `body.controls` overrides the shared `height: 100%`: a body pinned to the
window's height reports the window's height back, and the card could never grow.
Collapsing turns it into a pill; the mode picker appears only while paused, since a mode cannot
usefully change between one click and the next, and it is what made the old bar 452 px wide.

Editing puts a full-display window on **every** display rather than only the one holding the region,
which is what makes moving the region to another monitor work: each editor converts client to screen
coordinates with its own display origin, and whichever one you draw on wins. Outside editing the
boundary shrinks to the region itself and takes `setIgnoreMouseEvents`, so recording never swallows a
click. The boundary is solid and pulses while recording, dashed and grey while paused.

Overlays must not appear in their own capture. `setContentProtection(true)` is what keeps them out,
and **it is applied after the window is shown, never at creation**: on Windows it sets a display
affinity on the native handle, and a handle that has not been realised yet does not take it. Setting
it in the constructor looked correct and silently did nothing, which put the recording card inside the
screenshots it was displaying.

`overlay.withHidden(fn)` is the fallback for Linux, where content protection is a no-op. It hides
every visible overlay for the duration of `fn` and restores exactly the ones it hid, reapplying
protection on the way back. Hiding a window is visible as a blink once per captured step, so it is
used only where nothing else works. `setOpacity(0)` is not an alternative: it stopped captures
happening at all.

Anything the card hides is hidden with the `hidden` property, and `body.controls [hidden]` forces
`display: none` because several of those elements are flex containers whose author rule outranks the
browser's default for `[hidden]`. Without it the instructions stayed on screen behind the first
screenshot and collapsing never hid the buttons.

The card's icons come from `lucide`, the vanilla build of the same icon set `lucide-react` gives the
rest of the app, so a pause or a check is one drawing everywhere. The React package is not used here
because the overlay renderer has no React and importing an icon component pulls the runtime in with
it; `lucide` has no dependencies and hands back an `SVGElement`. Copying path data out of either
package is not the alternative — that silently pins the overlay to whatever the icons looked like on
the day it was written.

The mascot's geometry lives once, in `packages/ui/src/common/lib/mascot-shapes.ts`. `MascotIcon` renders it
as React with Tailwind classes so it themes with tokens; the overlay builds the same paths as DOM nodes
with CSS variables, because that renderer has neither React nor Tailwind. Two renderers, one set of
coordinates — copying the paths into the overlay would have made it the fifth copy of this drawing in
the repository.

The footer is always the same two slots: the transient action on the left, the one that moves the
recording forward on the right, filled. That filled button is `--deep` in every state. A paused
variant that filled it with `--accent` was tried and removed: the design system reserves the accent
for icons, links, focus rings, toggles and meters and never for a button fill, and the header
already says "Paused" beside a stopped dot, so the colour was carrying no information the card did
not already show. Close then Start while armed, Pause then Finish while
recording, Resume then Finish while paused. Finish keeps the right-hand slot for the whole recording
so it never moves under the cursor.

A capture is in flight from the moment the grab starts until the step is written, and `overlay.setBusy`
spans exactly that. Finish is disabled while it holds, so a recording cannot be finalised between the
screenshot and the row that points at it.

`pnpm --filter @mimik/desktop check:overlay` asserts persistence, clamping, one editor per display,
controls clearing the region, whole-screen mode dropping the boundary, clicks on the bar being
ignored, and the state changes — driving Start and Pause through a real renderer
click so the preload and IPC path is covered rather than the main-process methods alone. On Linux it
runs under `xvfb-run` when available (`xorg-server-xvfb`), so the check does not throw always-on-top
windows over whatever you are doing.

Everything under `out/main` stays flat: `chunkFileNames` is pinned alongside `entryFileNames` because
main-process code resolves `../renderer` and `../preload` from `__dirname`, and a shared chunk landing
in `out/main/chunks/` silently breaks every one of those paths.

## Desktop Capture Pipeline

A desktop capture produces an ordinary `Guide` with ordinary `Step` and `Screenshot` rows. There is
no desktop step type and no desktop guide type, so every exporter reads them without knowing where
they came from.

The work splits across the process boundary the way the extension splits across content script and
service worker. `DesktopRecorder` in main owns the global input hook, discards clicks outside the
capture region or while paused, and serialises the rest through a single promise chain so two clicks
cannot interleave. For each click it hides the overlays, grabs the display, crops to the region with
`nativeImage.crop`, and writes the result to disk. `DesktopCaptureSink` in the renderer
implements `CaptureSink` and writes through `@mimik/core/guides/service`, exactly as the extension's
`step-pipeline.ts` does.

The two surfaces reach that write by different routes but build the screenshot row the same way, so
`screenshotForElement` owns it. It turns an `ElementMeta` and whatever holds the bytes — a `Blob` in
the extension, a `src` on the desktop — into a row with the bounds in CSS pixels, the pixel ratio,
the click point, and the dashed target scaled by that ratio. Scaling the target is the part worth
having once: a rectangle multiplied in one surface and not the other puts the dashed box on the wrong
thing, and nothing about that fails a build. Everything else about the two paths genuinely differs —
voice narration, the deferred-description queue and the input finalisation exist only in the
extension, and the cursor mark, the application name and the fire-and-forget description exist only
on the desktop — so only the row builder is shared.

Main cannot `invoke` a renderer, so `ask()` sends a request with a generated reply channel and waits
for `ipcMain.once` on it, with a timeout. The preload's `onRequest` is the other half. Guide creation
and step writes both ride it, because both need IndexedDB, which only the renderer has.

Screenshot bytes never cross the process boundary. Main writes each capture to a PNG under
`screenshots/` in `app.getPath('userData')` and sends the renderer only an id, a URL and the pixel
size, so the message stays small and no image data rides an IPC channel. The renderer stores that URL
on the row and the service fetches it back into a `Blob` on read, which is why every consumer still
sees the shape it always did. A large binary crossing IPC is the one thing this avoids: the buffer a
native capture hands back points at memory the capture library still owns, and it does not reliably
survive the trip.

The renderer reads those files over a registered `mimik-screenshot://` scheme rather than being given
filesystem access. Main decides what that scheme will serve, the id has to look like a uuid, and
context isolation stays on. The scheme is declared privileged before the app is ready, or `fetch`
inside the renderer refuses it, and any entry point that reads a guide has to register the handler,
which includes the checks.

Files outlive the rows that point at them, because deleting a guide only removes database rows. The
renderer sends every known screenshot id to main at startup and main deletes any file not in that
set, so an interrupted delete costs disk until the next launch rather than forever.

Which window is focused is read **after** the settle delay, not when the click arrives. The input hook
fires on the press, and the operating system has not necessarily moved the foreground window yet, so
asking first frames whatever was in front a moment ago — the recording card included, if that was the
last thing touched. Reading it beside the grab is the only ordering that describes the screen being
photographed.

The card itself is not focusable, so clicking Pause or Finish never makes the app frontmost and never
changes what active-window mode will frame next. The region editors stay focusable because they read
Enter and Escape; the card has no keyboard of its own to lose.

What a capture frames is `captureMode`'s decision, and `frameFor` owns it: the focused window's
bounds, the whole display under the cursor, or the drawn region. The window rectangle is resolved on
every click rather than once at Start, so a window that moves or is resized between steps is followed
with no extra work, and it falls back to the whole display whenever the lookup fails or reports a
rectangle that does not contain the click. Active-window mode therefore degrades to whole-screen
rather than erroring, which is also what a Wayland session gets.

Window bounds come back in the platform's own coordinates. Windows reports physical pixels while
every rectangle elsewhere in the app is in DIP, so `focusedWindow` converts through `screenToDipRect`
before returning — without it a high-DPI machine crops a rectangle scaled by its own DPI factor.

`elementSource` is `'uia'` when the accessibility lookup answered and `'screen'` when it did not.
A `screen` step still knows the click point, a fixed target box around it, the display scale factor
and the foreground app and window title; it just knows nothing about the control. That is what every
step degrades to where the addon has no build, where the lookup times out, and on every platform but
Windows.

The lookup starts the moment the click arrives and is awaited after the grab, so it overlaps the
settle delay and the screenshot instead of adding to them. That it runs early is not only for speed:
the control has to be read before the click takes effect, or a menu that has opened or a button that
has vanished is what answers. It is the mirror of the focused-window read, which has to happen late
for the same reason — the window the click moved to the front is the one being photographed, but the
control the click landed on is the one that was there before. It is capped at 1500 ms and a miss is
`null`, never an error — a slow or unresponsive foreign application costs a step its metadata, not
the recording.

A desktop step zooms toward the click, never into it. `screenshotForElement` takes a `zoom` mode:
`element` writes `bounds` and is what the extension keeps, `click` writes an explicit
`edits.viewport`, and `none` writes neither.

The extension's rule cannot serve both. `resolveViewport` pads `bounds` by `PAD_RATIO` of the image
but never beyond `MAX_PAD_MULTIPLE` times the element, which suits a page where a control is a real
fraction of the viewport and collapses on a screen grab: a 30 px window button against 2560 px gives
a crop a few hundred pixels wide, which the card then stretches. Magnification past 1:1 cannot look
good, because the detail is not in the file.

So the zoom is a level between 1 and 5 in steps of 0.25, `snapZoom` holds it there, and
`clickZoomViewport` divides the frame by it and centres the result on the click, clamped inside the
edges. The level itself is `autoZoom`'s: the capture's width over the guide column's, so every step
renders its content at the same size however it was framed. A 2560 px screen grab at 1.5× scaling
gives 2.25, a 1200 px window gives 1, and a small one gives 1 — the same button is the same size on
every page of the guide, which a fixed fraction of the frame cannot do. The level is stored beside
the region in `edits.zoomLevel`, so it can be re-derived or overridden later without recapturing.

A setting only seeds new recordings, so the guide view carries its own Zoom control and `rezoomEdits`
rewrites the steps already captured. It recomputes from `clickPoint` and the frame, which every row
already holds, so nothing is re-captured and nothing is lost. A guide therefore stores no zoom of its
own — the level lives per screenshot and the control simply rewrites each one.

Version history does not report a zoom. `snapshot-diff` counts a changed `edits.viewport` as a crop,
and zoom writes that same field, so re-zooming a guide read back as "3 images cropped" — the history
describing the app's own framing as the user's edit. The diff now counts it only when `zoomLevel` is
absent on one side or the other, which is exactly when a person set the region. Cropping a step by
hand still registers, including when it replaces an app-set zoom.

Which steps it may touch is `edits.zoomLevel` itself: present means the app chose the region, absent
means a person did. `AnnotationEditor` clears it whenever the crop tool writes a new viewport, so a
hand-cropped step survives every later re-zoom. `rezoomEdits` returns null for those, and for a step
already at the wanted level, so the pass writes only what changes.

`guideActions` on `TopNav` is the slot it mounts into, beside Edit and Export and under the same
`exportData` guard, so the control appears exactly when the rest of the guide toolbar does. The
extension passes nothing.

The control is a plain `SelectTrigger`, never `asChild` around a `Button`. `SelectTrigger` renders
its own chevron beside whatever children it is given, so with `asChild` the `Slot` receives two
children and throws `React.Children.only`, which unmounts the whole renderer — a blank window with
the guide's name still in the title bar, and nothing in the console of the app itself. `Button` is
not a `forwardRef` either. Anywhere a Radix trigger needs to look like a button, style the trigger.

`zoomLevel` in capture settings overrides the automatic choice; `null` means derive it. Main cannot
value-import core, so `settings.ts` carries its own three-line `snapZoom` rather than the one in
`record.ts` — the same constraint that keeps `clamp` local in `capture/screenshot.ts`. The renderer
has no such limit and reads `MIN_ZOOM`, `MAX_ZOOM` and `ZOOM_STEP` from core to build the picker, so
the list of levels cannot drift from the snapping.

It goes in `edits.viewport` rather than `bounds` because `resolveViewport` returns that verbatim, so
the region is exactly what was computed rather than what the padding rule makes of it, and
`resolveFrameViewport` gives the video exporter the same starting frame before it eases toward
`edits.target`. The mode is written into the data rather than branched on `client()`, so a desktop
guide frames the same way in whatever opens it, exports included, and nothing shared changes for the
extension. `check:pipeline` asserts the viewport sits inside the frame at between 1× and 2×.

`targetRect` decides what the dashed target in the screenshot encloses. The control's own rectangle
wins when there is one, which is the whole point of reading the accessibility tree; it falls back to
a 28 px box around the click when there is no element, when the rectangle covers more than half the
frame, or when it does not fit inside the frame. Without those two guards an unsupported application
returns its top-level window and the target outlines the entire screenshot.

Typing is one step, and the text in it is read rather than reconstructed. The keyboard hook decides
only *when* a typing session starts and ends; what was typed comes from the focused element's value
in the accessibility tree at the moment the session closes. That is the whole reason there is no
keycode table, no layout handling, no dead-key state and no IME composition tracking in this
codebase — the machinery those need exists to answer a question we do not ask.

A session opens on any key that is not a modifier, not `Enter`, `Tab` or `Escape`, and not held with
`Ctrl`, `Alt` or `Meta`, and every such key also appends to a buffer of what was typed. It closes on any of those, on a click, on pause, on stop, or after 1200 ms
with no keys. `Shift` plus a letter still counts as typing, which is why modifiers are tested
individually rather than as a set.

Closing a session does not guarantee a step. The focused element is read first, and nothing is
written unless it is a text field with something to show for it. A password field is the exception
in the other direction: it reports no value by design, and the step is written anyway with no
`inputValue`, worded "Type password" rather than naming any contents.

Keys that are not typing get their own step, unless `captureKeys` is off. A shortcut always does; `Enter`, `Tab` and `Escape` do
only when no typing session was open, because the `Enter` that submits a field is part of that
field's step rather than a step of its own. Auto-repeat is collapsed the way a double click is —
`isRepeatKey` drops the same keycode within 500 ms, so holding a key down is one step.

Naming the key is the only place a keyboard layout is consulted. `keyLabel` maps the hook's scancode
through `MapVirtualKeyExW` against the **foreground window's** layout, so the same physical key reads
as `Q` on QWERTY and `A` on AZERTY, which is what the application being recorded will have acted on.
`ToUnicodeEx` is deliberately not used: it would name punctuation too, but it mutates the thread's
dead-key state as a side effect, and a shortcut only needs the letter, digit or named key. A key that
maps to none of those yields no label and therefore no step, rather than a step nobody can follow.

Two sources compete for the text and `chooseTypedText` picks between them. The field's value wins
by default, because it is what is actually on screen and it survives caret movement, selection and
autocomplete; turning `typingSmartDetection` off skips that read entirely and always uses the
buffer. The keystroke buffer wins in three cases: the focused element reports no value, the
value is empty, or the value runs more than twice the buffer and past 80 characters. That last rule
is what makes rich text work — in a word processor the "field" is the whole document, so its value
is the entire text rather than the sentence just typed, and the buffer is the only thing that knows
which part is new. A non-text role yields nothing at all, so a keypress in a file manager is not a
step.

Building that buffer is the only place a keystroke becomes a character. `resolveKey` runs
`ToUnicodeEx` against the foreground layout with the modifier state the hook reported and the real
caps-lock state, and appends what comes back; `Backspace` removes one. Dead keys fall out of this
for free: `ToUnicodeEx` returns nothing for the accent itself and the composed character for the key
after it, because it keeps that state per thread and every keystroke goes through the same one. The
cost is that the state is real and can be left armed, so `resetDeadKeyState` flushes it whenever a
session ends.

Values are stripped of `\uFFF9`–`\uFFFD`, `\uFEFF` and `\u200B` before use. Accessibility
implementations use those to mark annotations and inline objects, and they arrive as invisible
garbage in the middle of otherwise ordinary text.

`DesktopRecorder` takes its region, its overlay hiding and its sink positionally, and everything
else — the display grab, the settings, the overlay hit test, the element lookup and the focused
field — through one optional hooks object, so `check:pipeline` replaces exactly the ones it needs
and names them at the call site. The grab defaults to `captureDisplay`, and `check:pipeline` feeds
it a generated frame instead. The crop arithmetic, the sink, the step write and all
four document exporters then run without a working screen-capture path, which matters because a real
grab depends on the machine it runs on. Whether a real grab works is `check:capture`'s question, not
this one's.

`pnpm --filter @mimik/desktop check:pipeline` captures two clicks into a throwaway guide, then
asserts the steps landed on the guide, the screenshot is cropped to the region, the description came
from the shared heuristic, and HTML, Markdown, PDF and DOCX all export non-empty. A stubbed element
lookup covers the two things the addon feeds: the metadata reaching the written step, and
`targetRect` preferring the control's rectangle while rejecting an oversized or overflowing one. It then loads the
real `index.html` and asserts that window answers a capture request and navigates to the finished
guide, because the checks otherwise run against their own renderer and never exercise the entry
point the user actually gets.

The renderer answers those requests from `capture-host.ts`, imported for its side effect by
`main.tsx`. Nothing else registers the sink, so dropping that import silently costs every capture a
fifteen second timeout and no visible error.

Stopping a recording names the guide before the window is told, so the view opens on a titled guide
rather than the placeholder the extension fills in with AI. Desktop has no AI title, so the name
comes from the recorded application, or a generic one where no application was identified. Without
it the guide screen waits forever on a title that is never written.

**Every AI request goes through the main process.** A renderer is an ordinary web origin, so a
`fetch` to `api.anthropic.com` is blocked by CORS and throws — which reads as a rejected key when it
is really a request that never left. The extension never hits this because it validates in the
background service worker, where `host_permissions` exempts it, and that is the thing the desktop had
no equivalent of. `CoreEnv` therefore carries an optional `fetch` and core calls it through
`coreFetch`, so `validateApiKey`, `getAIDescription` and `generateGuideMeta` all route through
whatever the surface supplies. The desktop supplies a wrapper over `mimik:ai:fetch`, which runs
Electron's `net.fetch` in main. It refuses any url that is not `http:` or `https:`, because the
renderer names the url and main is the one holding the network.

A failed key check says which failure it was. `reason: 'network'` is worded "could not reach the
provider", not "rejected" — the two are indistinguishable to a user and only one of them is their
key's fault.

Descriptions and the guide's name are written by the user's own provider key when there is one, and
by rule when there is not. `getAIDescription` takes a serialised context string rather than a
`DOMContext`, because the desktop has no DOM to hand it: `serializeScreenContext` writes the same
shape of thing from the application, the window title, the control's role and name, and the value,
which is what UIAutomation knows. No screenshot is ever sent.

A step is written with its heuristic description immediately and `aiPending` set, then rewritten
when the model answers. The flag is cleared **whichever way that goes** — a miss, a failure and a
missing key all clear it — because a pending flag that only clears on success is the same trap as a
title placeholder that only resolves with AI: without a key it stays there forever.

Stopping a recording names the guide twice. The application name lands first so the view never opens
on a placeholder, and `generateGuideMeta` replaces it if a key is configured. Ordering it that way
means the guide is always named, and the AI title is an improvement rather than a prerequisite.

Step descriptions are only as good as the element lookup. With one, `buildFallbackDescription` gets
a role and an accessible name and writes the same wording it writes for the extension. Without one
it has nothing but the action, and every step in the guide reads the same — which is what a
`screen`-sourced recording looks like.

## Feature Hooks

A cluster of `useState` that moves as one thing is a hook, not a pile of state in a component.
`ExportPreviewModal` held fourteen, of which eleven were two jobs wearing one coat: `useGuideExport`
owns the document preview and every download, `useVideoPreview` owns the encode, its progress, its
container and the deferral past twenty-five steps. The modal keeps three — the options, the tab, and
nothing else.

The shape repeats wherever an async job meets a component: `data`, `loading`, `error`, `progress`
spread across four `useState` and one long effect. `useGuideDescription`, `useSnapshots`,
`useSettingsAutosave`, `useEditHistory` and `useTextStyle` are the same extraction, and
`useAiSettings` and `useKeyCheck` were already it before the pattern had a name.

What stays a `useState` is state one component owns and nothing else reads: a dialog's open flag, an
input draft, a hover. Grouping those into a hook adds indirection and removes nothing. The test is
whether the values change together and are read together, not how many there are.

`useSettingsAutosave` is the odd one: it holds no settings at all. The fields stay in the view
because each is bound to its own control; what the hook owns is the machinery around them — the
snapshot, the diff, the debounce, the flush on unmount and the saved badge — which is the part that
was subtle and the part nobody should have to read twice.

`AnnotationEditor` went from twenty-eight states to sixteen across three hooks — `useEditHistory`,
`useTextStyle` and `usePointerGesture`, the last holding everything the pointer is doing right now:
the shape being drawn, the crop being dragged, the hover and grab cursors and the floating toolbar's
anchor. What is left is genuinely interdependent canvas state.

How it was done matters more than the count. A regex pass over the style names rewrote object keys
and type members as well as reads and broke the file's syntax; it was reverted and redone as a list
of exact string replacements. Every later cluster was done the same way. A file this size does not
take a search and replace.

## Fullview Store

One Zustand store, four slices — `library`, `search`, `guide`, `editor` — each living in its
feature's `store/` folder and merged in `stores/fullview.ts`. `useFullview` sits beside it in
`stores/use-fullview.ts` and wraps `useShallow`, which is what makes the
object-returning selectors all over the fullview safe rather than a re-render trap.

Slices rather than separate stores because one cross-domain write genuinely exists: opening a
different guide has to close the editor and its history panel. As a flat store that lived inside
`setGuideExportData` as three stray field resets and was invisible. As a slice it is
`{ guideExportData, ...CLOSED_EDITOR }`, with `CLOSED_EDITOR` owned and named by the editor slice —
the coupling still happens, it just says so. Four separate stores would have made it a subscription
between stores, which is worse.

Two things in here are deliberate and look wrong at a glance. `flushFocusedField` reaches for
`document.activeElement` from inside the store, because leaving edit mode has to commit whatever is
in the focused input before the component unmounts and the keystrokes are lost. `scrollToStep` sets
an id and clears it 100 ms later, because it is a signal rather than state — the alternative is an
event emitter beside the store for one interaction.

## Desktop Home Screen

**A guide looks the same everywhere; getting to one does not have to.** Viewing, editing, annotating
and exporting live in `packages/ui` and both surfaces mount the same components, so a step card reads
identically in a browser panel and in a desktop window. Everything before the guide is free to differ,
because the products differ: the extension records a tab, has no capture mode to choose and lives in
400 px of browser chrome, while the desktop records the operating system in a window five times as
wide and has to pick between three framings first. Forcing those two shells together makes both worse.
Divergence inside the guide is a bug; divergence in how you reach it is not.

The header is the exception that proves it. `TopNav` is the extension's own dashboard header, moved
into `packages/ui` and mounted by both surfaces, because a header is navigation rather than capture
and there was nothing about it worth diverging on. The desktop had grown its own `TopBar` — a text
wordmark, a gear, and a green "Ready to record" pill — and every part of that was worse: the mascot
is the mark everywhere else, and a pill that only ever says the app is idle is chrome that is never
news. It went, along with the second bar under it, which halved the chrome from 116 px to 64.

`TopNav` takes only a `Route` and reads the rest from `useFullview`, which `GuideContent` already
fills, so the guide title, the step count and the export data arrive with no desktop wiring at all.
Its one desktop-only prop is `onSettings`: the extension has a browser options page and the desktop
does not, so the gear exists here and only on the library route. `onNavigate` is its counterpart and
exists for one reason: settings is a boolean laid over the route rather than a route of its own, so
the header could navigate underneath an open settings pane — the pill moved to Trash and the pane
stayed. Firing it on the click rather than watching the route is deliberate, because clicking the
already-active item produces no hash change and that is exactly the click that means "get me out of
here". Moving it brought `SearchModal`,
`ExportPreviewModal`, `VideoStepPlayer` and two search components with it — each needed exactly two
import rewrites, `#imports` to `@mimik/core/env` and `@/core/*` to `@mimik/core/*`, because nothing
in them was ever extension-specific beyond how WXT resolves a module.

Below the header both surfaces mount the same dashboard. The desktop briefly had its own
`HomeScreen` — a hero, a question and a Start Capture button — and it existed for one reason: the
extension's dashboard has no way to start a capture, only its side panel does, so there was nothing
to inherit and the hero was copied from the side panel into a window five times its width. That one
missing affordance was the whole of the apparent divergence between the two products.

`LibraryContent` now takes an optional `onStartCapture` and renders the button itself, so the
dashboard can begin a recording on either surface and `HomeScreen` is gone. What the button does is
the app's to decide, because the two actions have nothing in common: the desktop opens
`CaptureSheet`, and the extension opens the side panel, which is where its recording view lives.
Filling that gap was an improvement to the extension in its own right — browsing the library in a
tab and wanting to record used to mean going to find the side panel yourself.

Pressing Start Capture opens `CaptureSheet` rather than arming immediately. The sheet is where the
capture mode is chosen, because the mode decides what every screenshot in the guide will frame and
that is worth one deliberate choice before recording rather than a control discovered afterwards.
Picking a mode writes `captureMode` straight through to `capture-settings.json`, so the sheet reopens
on whatever was used last and the recording bar's own picker reads the same value.

The sheet holds the mode and nothing else. `captureOutsideClicks` was tried there and taken out: read
beside a rectangle the user has just chosen, an option that falls back to the whole screen reads as
undoing that choice, when what it really decides is whether a click outside the rectangle is dropped
or kept. It stays in Settings, where there is room to say so. Nothing in the sheet is editable in two
places.

Start on Selected Region opens the region editor first and arming happens when the rectangle is
confirmed. The other two modes arm directly, because they have no rectangle to draw.

Guide rows carry an avatar built from the guide title through `getDomainInitial`, which gives a stable
letter and tint from a hash without a second query. A desktop guide has no web address, so
`FaviconImg` has nothing to fetch and the title, which is named after the recorded application, is the
only identity available. Star and delete are always visible rather than revealed on hover, matching
the side panel; the fullview list hides them until hover and that reads as inert in a window this wide.

Routing is `useRoute` and `navigate` from `@mimik/ui`, not a hand-rolled `hashchange` listener. The desktop had one
matching `#guide/<id>`, which is the same scheme the shared router already parses, so adopting it
cost nothing and bought Starred and Trash the routes the header needs. `HomeScreen` serves the `all`
category and `LibraryContent` serves the other two, because the hero and Start Capture belong on the
screen you land on and nowhere else.

## Capture Settings

Five settings that only a desktop capture needs live in `capture-settings.json` beside the region,
read by main rather than by core, because none of them mean anything to the extension.

| Setting | Default | Effect |
|---|---|---|
| `captureMode` | `window` | What each screenshot frames: the focused window, the whole screen, or a drawn area |
| `showCursor` | on | A pointer is drawn into the screenshot at the click point |
| `cursorStyle` | `arrow`, `dot` on Linux | Which pointer shape gets drawn |
| `screenshotDelayMs` | 0, capped at 2000 | Extra wait between the click and the grab |
| `captureOutsideClicks` | off | Whether clicks beyond the capture area are recorded at all, in `region` mode only |
| `captureKeys` | on | Whether a shortcut or a named key becomes a step |
| `captureTyping` | on | Whether typing becomes a step |
| `typingDebounceMs` | 1200, clamped to 200–5000 | Quiet time that closes a typing session |
| `typingSmartDetection` | on | Off means the keystroke buffer is used and the field's value is never read |
| `zoomLevel` | automatic | How far a step zooms toward the click: `null` derives it, or 1–5 in 0.25 steps |
| `shortcuts` | three accelerators | Global keys for start/stop, pause/resume and capture now |

`normaliseSettings` runs on every read and write, so an out-of-range delay clamps and an unknown
cursor style falls back to the platform default rather than reaching the recorder.

`CursorStyle` and `CursorMark` are core's, not main's. The mark is written in main, crosses IPC, and
is stored as `edits.cursor`, which the renderer reads through core's type — so two declarations had to
agree by hand, and did only by luck. Main cannot value-import core, so the runtime list of styles
still lives there, but `Record<CursorStyle, true>` makes the compiler reject it the moment core's
union grows. That is the general shape of the fix wherever main needs one of core's closed sets: take
the type, keep the value, let the type check the value.

Electron exposes no way to read the real system cursor bitmap and a screen grab never includes the
pointer, so the shapes are drawn as canvas paths. The cursor is an entry in `edits` beside the click
target, not something baked into the stored bytes, so `renderScreenshot` draws it and every exporter
and the editor show it with no export-side work. Keeping it out of the file means the capture is
never decoded and re-encoded on the way to disk, and the pointer can be moved or removed later
without touching the original.

The mouse button decides the action: the right button records as `auxclick` and everything else as
`click`, so a right click reads as "Right-click …" rather than being indistinguishable from a left
one. Middle clicks fall in with left, which is no worse than before and avoids claiming a wheel
press was a context menu.

A double click is one action, so it is one step. `isRepeatClick` drops a press that lands within
500 ms of the one before it, and the clock is reset on every press rather than on every capture, so a
burst of clicks stays suppressed until there is a real gap. The rule is time only, deliberately: it
takes its timestamps as arguments rather than reading the clock, so it is exercised without a mouse.

The cost is that two deliberate presses on different controls less than 500 ms apart become one step.
Matching on position as well would separate them, and that was tried and dropped in favour of keeping
the rule identical to the one this behaviour was modelled on.

A click outside the capture area cannot be framed by a region that does not contain it, so those
captures fall back to the whole display the click landed on. `shouldCapture` is exported for that
decision rather than being inline in the hook handler, so the rule is testable on its own. It only
filters in `region` mode; the other two modes frame every click by construction.

`check:pipeline` covers all five: clamping and persistence round-trip through the real file, an
unknown mode falls back, the opt-in rule holds in four positions, a double click collapses to one step, `frameFor` returns the right
rectangle for all three modes including both window fallbacks, a 400 ms delay measurably slows the
grab, and the same synthetic frame renders to a different size once a cursor is drawn over it. It restores whatever
settings were on disk when it finishes.

## Desktop Settings

Three sections behind one left nav: Capture, AI descriptions, Shortcuts. The split is the same one
that decides where a file lives. Capture and Shortcuts describe things the extension has no concept
of, so they are written in `apps/desktop` against `capture-settings.json`. AI descriptions are
identical on both surfaces, so `AiSettings` lives in `packages/ui` and each app hands it a
`validate` function — the desktop passes core's `validateApiKey` directly, and the extension goes
through its background messaging, which is the only part that differs.

All three sections are cards with one shell: the same border, radius, padding and 28px icon header
`AiSettings` already had. Rows inside a desktop card stay label-left, control-right, which is right
at this width, while the AI card keeps the stacked 11px labels it needs in 400px of side panel — the
two are never on screen at once, and matching them would mean branching that shared component on
`client()`. The shell alone is what makes the three read as siblings. Capturing is two cards,
Screenshots and Keyboard, because the divider that separated those groups was already doing a card
boundary's job.

Every control in there is the shared component — `Select`, `Input`, and a checkbox carrying
`accent-accent` — never a bare `<select>` or `<input>`. That is the difference the card shell alone
did not fix: a native select draws the platform's own chevron and popup, a native number field draws
spinner arrows on Windows, and a native checkbox is the browser's blue, so the section read as a form
bolted into the app rather than part of it. `styles.css` also kills the number spinners outright,
because `Input` is a text field's styling wrapped around a control the platform still decorates.

The pane carries no heading and no close button. The left nav already names the section, so a title
repeating the highlighted item is the same word twice on one screen; and `TopNav` stays visible and
mounted the whole time settings is open, so All Guides, Starred, Trash and the wordmark are all exits
already. Both were tried and removed — first a "Close" entry under the three sections, styled like
them, which read as a fourth section that happens to quit, then an X in the pane corner, which by
then duplicated the header it sat beneath.

`AiSettings` is the extension's own AI card, lifted out of `SettingsView` rather than rewritten. A
parallel implementation was tried first and the wording immediately drifted — the extension said
"API key verified", the copy said "134 models available", and the spend warning was missing
altogether, because the extension shows the verdict, the model list and the warning as three
separate things and the copy collapsed them into one line. Two implementations of the same screen
diverge by default; one does not.

What moved with it: `KeyStatusNote`, `KeyWarningNote`, `ModelList` and `SecretInput`, one file each
under `ai/components`, and `useKeyCheck` in `ai/hooks`. The hook takes its validator as an argument, which is the only part
that genuinely differs — the extension goes through background messaging because a service worker is
what has `host_permissions`, and the desktop calls `validateApiKey` directly on top of the main
process fetch.

The rest of `SettingsView` stayed put. Voice narration, smart blur, brand logos and the microphone
picker have no desktop meaning, and it reaches for `@/lib/browser-api`. Splitting it did mean the
autosave had to change shape: the AI fields left the parent's snapshot, so `AiSettings` reports its
own changes through `onChange` and both halves queue into the same debounced flush. `SettingsView`
still keeps the provider and key in state for one reason — `resolveVoiceApiKey` falls back to the AI
key when no voice key is set — and it updates them from the patches the card sends up.

The shortcut recorder reads a keystroke and writes an Electron accelerator. It refuses a bare key,
because a global accelerator with no modifier takes that key from every application on the machine,
and it ignores a modifier pressed alone, because `Shift` is not a shortcut. `accelerator()` is a
pure function over the event so it is tested without a keyboard.

## Capture Shortcuts

Three global accelerators, stored in `capture-settings.json` beside everything else: start/stop,
pause/resume, and capture now. They default to `Alt+Shift+R`, `Alt+Shift+P` and `Alt+Shift+C`,
because a global accelerator is taken from **every** application on the machine for as long as it is
registered: `Ctrl+Shift+R` would break reload everywhere, and `Ctrl+Alt+<letter>` is AltGr on most
non-US layouts, so it would eat characters people actually type. `Alt+Shift` held with another key
is rare in applications and does not trigger the Windows layout switch, which fires only on
`Alt+Shift` pressed and released alone. Function keys were the first choice and are wrong: laptops
increasingly do not have a usable row.

That is also why only start/stop is bound all the time. Pause/resume and capture-now can do nothing
outside a recording, so `shortcutMap` returns them as null until one is running and `applyShortcuts`
rebinds on every state change. An empty accelerator string clears the binding rather than restoring
the default, so a shortcut can be turned off; a missing one falls back.

Registration is the part that cannot be trusted. `globalShortcut.register` returns false when
another application already owns the key and throws on an accelerator Electron cannot parse, so
`bindShortcuts` catches both and hands back the list it could not take rather than failing the
launch over a key clash.

**Rebinding must never happen inside a shortcut's own handler.** Unregistering the accelerator that
is currently firing hangs the main process on Windows — the app goes to "not responding" with no
error anywhere. Two things keep that from happening: `bindShortcuts` returns immediately when the
wanted set matches what is already bound, which covers pause and resume since both count as
recording, and `applyShortcuts` defers the work with `setImmediate` so it is never on the handler's
stack whatever the set turns out to be. Pausing from the card worked throughout, because that path
reaches the rebind through IPC rather than from inside a global shortcut.

Start/stop goes straight from hidden to recording rather than arming first, because a shortcut whose
job is to start recording should not need a second press. The stored region is used as it stands,
which is what makes that possible in `region` mode.

Capture-now writes an ordinary click step at the cursor. There is no separate action for it: the
point of pressing it is that the cursor is already on the thing worth capturing.

The keystroke that drives a shortcut must not also be recorded as one. Without that check, pausing a
recording writes "Press Alt+Shift+P on Mimik" as a step, which is both wrong and confusing, and
resuming writes another. `matchesShortcut` compares a keystroke against each configured accelerator
before `captureKey` writes anything, and it compares by parts rather than by string so
`Shift+Alt+P` and `Alt+Shift+P` are the same shortcut. `CommandOrControl` resolves to Control
everywhere but macOS.

## Export Formats

| Format | Generator | Details |
|--------|-----------|---------|
| HTML | `core/export/html-export.ts` | Self-contained, base64 images, inline CSS |
| PDF | `core/export/pdf-export.ts` | jsPDF, A4 portrait, auto page breaks |
| Markdown | `core/export/markdown-export.ts` | Standard MD with base64 image data URLs |
| DOCX | `core/export/docx-export.ts` | Lazy-imported, Word-compatible |
| Video | `core/export/video-export.ts` | WebCodecs via mediabunny (lazy), mp4/H.264 with WebM/VP9 fallback |
| GIF | `core/export/gif-export.ts` | gifenc (lazy), same frame timeline as the video; user picks Small/Medium/Large from `GIF_SPECS` |

The preview player is told the container rather than assuming one. `pickContainer` answers `mp4`
only when the machine can encode H.264 and falls back to WebM/VP9 otherwise, so a hardcoded
`type: 'video/mp4'` on the player describes the file wrongly on any machine without an H.264
encoder — a VM without GPU acceleration, typically. The export itself succeeds and the chapter list
fills in, so the only symptom is a black frame reading 0:00 / 0:00. `VideoStepPlayer` now takes the
mime alongside the url and `ExportPreviewModal` reads it off the blob. `check:pipeline` asserts the
blob's type matches the extension, which is the pairing that was wrong.

Video frames reuse `renderScreenshot`, so the auto-crop, click-target outline, annotations and
redactions are already baked in. Each step holds 1.5s wide, eases into a crop around the target
over 0.73s, holds 3s close, and consecutive steps cross-dissolve over 0.33s at 30fps. Capability
probing lives in `video-support.ts`, which must stay free of mediabunny imports because both
export UIs load it eagerly.

`composeGuideFrames` owns that timeline and hands each finished frame to a sink, so video and GIF
draw identical frames at whatever fps the caller asks for. GIF runs it at the frame rate and size in
`GIF_SPECS` (Small/Medium/Large, 8-15fps) because it has no interframe compression: every frame of a
zoom or dissolve is a full frame, so 30fps at 720p runs to hundreds of megabytes. Each frame gets its
own 128-colour palette, since one global palette lets the branded cover card tint every screenshot
behind it. Encoding yields to the event loop every few frames to keep the tab responsive; moving it
to a Web Worker crashed the renderer with `KILLED_BAD_MESSAGE` on the first `postMessage` and is
unexplained.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension framework | WXT (Manifest V3) |
| Language | TypeScript |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| Components | shadcn/ui |
| State (capture) | xstate |
| State (UI) | Zustand |
| Storage | Dexie.js (IndexedDB) |
| Messaging | webext-core |
| Export | jsPDF, docx, mediabunny (WebCodecs video), gifenc (GIF), client-side HTML/Markdown |
| AI (optional) | Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`) |
| Event queue | p-queue (concurrency: 1) |
| Icons | Lucide React |
| Dates | dayjs |
| DOM utils | css-selector-generator |

## Design System

All colors are defined as CSS variables in `src/ui/global.css` and used via Tailwind classes:

| Token | Color | Usage |
|-------|-------|-------|
| `--color-foreground` | `#1E1B4B` | Primary text (deep navy) |
| `--color-muted-foreground` | `#6B7280` | Secondary text |
| `--color-border` | `#C7D2FE` | Borders, dividers (lavender) |
| `--color-secondary` | `#EEF2FF` | Light wash backgrounds |
| `--color-accent` | `#4F46E5` | Icons, links, focus rings, toggles, meters (indigo) — never a button fill |
| `--color-primary` | `#1E1B4B` | Primary buttons, badges, dark backgrounds |
| `--color-primary-foreground` | `#C7D2FE` | Text on dark backgrounds |
| `--color-lavender` | `#C7D2FE` | Soft accent |
| `--color-purple` | `#4F46E5` | Primary indigo |
| `--color-deep` | `#1E1B4B` | Deepest navy |
| `--color-violet` | `#38BDF8` | Sky blue accent |
| `--color-success` | `#059669` | Success green |

Font: Poppins (loaded via `@fontsource/poppins`).

## Key Technical Details

- **Async event queue** in content script (PQueue, concurrency 1) serializes capture work — each action awaits the background round-trip (screenshot + step write, not the AI description) before the next starts
- **Hover ring hidden when work is enqueued** (`CaptureController.enqueue`, instant `display:none`), and `show()` stays suppressed until the queue drains — a second click while the first capture is still in flight can't bring the ring back before the screenshot. `pointerdown` hides it earlier still, on top of `captureAction`'s 3-frame wait
- **Input session** aggregates all typing on a field into one step — click creates it, keystrokes update description, finalize takes final screenshot
- **DOM context** sent as text to AI instead of screenshots — 15-30x cheaper per step
- **Hover ring** (`lib/hover-ring.ts`) is a closed-Shadow-DOM host marked `data-mimik-ignore`, shared by recording and the blur picker (purple). Recording reads the user's `targetColor` so the live ring matches the dashed target baked into screenshots. Never drawn on `iframe`/`embed`/`object` — a capture inside a subframe can't hide the top frame's ring
- **Content script injection** pings first, falls back to `chrome.scripting.executeScript()` for tabs without the script
- **xstate snapshot** persisted to sessionStorage so the state machine survives service worker restarts
- **Recording notification** uses `animationend` event (not hardcoded delays) for timing
- **Font loading** uses `@fontsource/poppins` (CSP-safe, no CDN dependency)
- **Cross-context sync** via BroadcastChannel — star/delete events update other views without full reload
