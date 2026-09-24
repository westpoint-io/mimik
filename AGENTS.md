# Mimik

Open-source Chrome extension that auto-captures browser workflows and generates step-by-step guides. No backend, no account, no data leaves the browser.

## What It Does

You click "Record," perform a workflow in your browser, and Mimik automatically captures each action as a step with an annotated screenshot and description. You can edit the guide, replay it on a live page, or export it as a file.

**Core loop: Record → Edit → Replay or Export.**

## Architecture

**Everything runs on the user's machine — in the Chrome extension or the desktop app. No backend.**

- Storage: IndexedDB via Dexie.js (browser-local)
- AI descriptions: optional, user provides their own API key in settings
- Export: generated client-side (no server rendering)
- No auth, no database, no hosting, no Docker

### Directory Structure

```
src/                     the Chrome extension (WXT)
├── entrypoints/         background, content, sidepanel, fullview, onboarding, options, offscreen, mic-permission
├── capture/             capture session, DOM event handlers and the capture sink, in the content script
├── blur/                smart blur picker and manager in the page
├── guideme/             Guide Me in the page
├── lib/                 extension plumbing: browser-api/, port/, offscreen/, voice/, update-notice/, messaging
├── ui/                  extension screens: sidepanel/, fullview/, onboarding/, options/, mic-permission/, shared/
└── locales/
packages/
├── core/src/            logic both surfaces share: capture, guides, export, screenshot, blur, guideme, i18n, env
├── ui/src/              React both surfaces share, grouped by feature
└── capture-native/      the Windows UIAutomation addon, in Rust
apps/desktop/src/
├── main/                Electron main: window, tray, capture pipeline, overlay windows, shortcuts
├── preload/             the contextBridge API
└── renderer/            the app window, the overlay renderer, settings/, ai/ and the checks
scripts/                 repository checks that pnpm lint runs
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
will want. A description never quotes one that reads as an identifier — no spaces, and a digit, a
separator or a camel-case join, like `fl-post-111` or `SaveButton` — because that is an id attribute,
not something a reader can find on screen. UIAutomation has no placeholder property in the API surface we bind, so that field stays
null there.

A fourth source, `screen`, knows only where the click landed: it fills `rect` with a fixed box around
the click point, `clickPoint`, `devicePixelRatio`, `app` and `window`, and leaves every identity field
null.

`tag`, `cssSelector`, `href` and `dataTestId` are DOM-only and absent elsewhere. `app` and `window`
are the reverse — desktop only — and so are `ancestors` and `children`, the role and name of up to
four elements above the target and twelve directly inside it, filled only when the target has no
name of its own. `inputType` is mostly DOM-only, but a desktop typing step sets it to
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

A loading screen covers the gap between launch and the window being ready: a 400 × 300 frameless,
transparent window, centred and above everything, with the mascot winking, the name and a sweeping
bar. It opens first thing in `whenReady`, and the main window's `ready-to-show` closes it and shows
the window — but only once the splash has been on screen for 1.5 s, one sweep of the bar, and never
later than 3 s if the splash itself fails to paint. The floor is counted from the splash appearing,
not from it being created: in dev its page took as long to load as the app's, so a floor counted
from creation had expired before the splash painted and it was closed unseen.

That load time was the shapes import. `mascot()` took the geometry from `@mimik/ui`, and in dev,
where nothing is bundled, importing the package entry loads every module in the package — the same
work the app window does. The splash and the overlay therefore import
`@mimik/ui/common/lib/mascot-shapes` directly, the one deep import besides `env` and `global.css`
that the lint allows; it is plain data, so it cannot drag the package in with it. A launch at login skips it, for the same reason `openAsHidden`
exists — that launch must not put anything on screen. `splash.html` draws the mascot with the
overlay's `mascot()` builder, so the drawing still comes from the one set of shapes.

The window also hides the moment a capture begins — Start in the sheet, the tray's area editor, or the
start shortcut — so Mimik never records itself, and it comes back when the guide is finished, or on
Cancel when it was open beforehand. Its renderer keeps full speed while hidden, because it is the
one writing every step. The tray icon carries a red dot for as long as a recording runs, and clicking
it then finishes the recording rather than opening the window.

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
| Focused foreign window | `@mimik/capture-native` on Windows, `get-windows` elsewhere | ours / prebuilt |
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

`activeWindow()` is the focused window on Windows and `windowAt(x, y)` the top-level window under a
point, and they replaced `get-windows` there. That package
downloads its Windows binary in an install script, pnpm only runs the scripts `onlyBuiltDependencies`
names, and without the binary `activeWindow()` returns nothing and throws nothing — so every Window
mode capture quietly fell back to the whole screen and no guide was ever named after its app.
`get-windows` still serves macOS, where the binary is in the package, and Linux, where it shells out
to `xprop`, and it stays the Windows fallback when the addon is missing.

The lookup is the foreground window with its visible frame, `DWMWA_EXTENDED_FRAME_BOUNDS`, rather
than `GetWindowRect`, whose rectangle includes the invisible resize border and would put a strip of
whatever is behind the window into every crop. A popup is framed as the application it belongs to:
when the foreground window covers no more than 80% of the largest monitor and of the whole desktop by
area, and it is a menu, dialog, dropdown, tooltip, owned, tool or captionless popup window, the
largest visible, uncloaked, unowned window of the same process that has a system menu and any caption
style is used instead. The app
name is the executable's `FileDescription`, falling back to its file name, which is what
`get-windows` reported, so guide names do not change between the two paths. `window.rs` holds the
popup and screen-coverage rules without COM or user32, so they are tested on Linux beside `hit.rs`.

Windows only. `is_supported()` answers false everywhere else and `elementAtPoint` resolves to null,
so the app, the checks and the recording pipeline all behave the same as when the binary is simply
missing. macOS is the same shape of work against `AXUIElementCopyAttributeValue` and is not done.

The implementation is `IUIAutomation::ElementFromPoint` and six property reads, plus a walk of the
control view when the element has no name. Named elements skip the walk, because every step of it is
another cross-process call into the application being recorded.

The hit test alone is not the answer. It returns whatever the application's provider says is at the
point, and some providers answer with a layer rather than a control: the Windows 11 search panel
reports a pane called "CoreInput" covering every result, so each click on a result was named after
it. Whenever the hit has children, its whole subtree is fetched with `FindAllBuildCache`, the
rectangles cached so the lookup is one cross-process call rather than one per element, and the
smallest element whose rectangle holds the point is used instead, skipping Chrome's tab-drag layer
(`TabDragContextImpl`), which covers the tab strip and would otherwise win every click there. A tie keeps the outer element,
since `FindAll` lists a parent before its children and the parent is the control. A text field is
left alone, because narrowing it would land on the text run inside and turn "Enter" into "Click".
`smallest_under` in `hit.rs` is that rule with no COM in it, which is why it is the one part of the
addon with tests that run on Linux. COM is initialised
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
`clearDeadKey` — are the keyboard, and unlike the first two they are synchronous, because
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

`biome.json` covers `src`, `packages/core`, `packages/ui`, `apps/desktop` and `scripts`. `packages/ui` was
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

## Code Layout

`packages/ui/src` is grouped by feature, not by the surface that first used a file: `ai`,
`annotation`, `common`, `export`, `guide`, `history`, `library`, `navigation` and `search`. Inside a
feature, components sit in `components/`, hooks in `hooks/`, plain functions in `lib/`, a store
slice in `store/`, and a `types.ts` only when several files share a type. `components/ui` holds the
shadcn primitives as the generator writes them, and `stores/` merges the slices.

The apps take the same shape one surface at a time. Each of `src/ui/sidepanel`, `fullview`,
`onboarding`, `mic-permission`, `shared` and `apps/desktop/src/renderer` keeps its components side by
side, its functions in `lib/` and its hooks in `hooks/`. `src/lib` is already a lib folder, so a
module there that held several functions became a folder named after it — `browser-api/`, `port/`,
`offscreen/`, `update-notice/` — and the voice pieces share `voice/`. An entry script such as
`overlay.ts` or `check-storage.ts` keeps only its dispatch and imports the rest from a folder of the
same name.

A file exports one thing — a component, a hook or a function — and is named after it. A hook or a
`lib/` function may keep one private helper that nothing else calls; a component file keeps none, so
its helpers live in `lib/`. Constants, types and objects of functions may sit beside the export they
serve. That rule holds in all four roots: `packages/ui/src`, `src/ui`, `src/lib` and
`apps/desktop/src/renderer`.

Exports are named. A default export can be imported under any name, so one component can read
differently at every import site; a named one is found by the same search everywhere. WXT
entrypoints and the config files keep their defaults because the framework reads them, and the one
`React.lazy` maps a named export onto the `default` it needs.

The apps import from `'@mimik/ui'` and nowhere deeper, except `@mimik/ui/env`,
`@mimik/ui/global.css` and `@mimik/ui/common/lib/mascot-shapes`, the mascot's geometry, which pages
that must load instantly take without the rest of the package. `src/index.ts` is the one file allowed to re-export. Inside the package every
import is relative — it never names itself, through the entry or otherwise, so it cannot cycle
through its own index. The extension build was diffed against the baseline from before the entry
existed: the content script came out byte-identical, and the whole build within a few hundred bytes.

State that several functions share lives in a `{ current }` holder — `localVoiceHost`, the offscreen
document's `creating` promise, `lastVoice` in `port/state.ts` — because an imported `let` is
read-only in the module that imports it, so a getter and setter pair could not be split without one.
The UI package's env adapter is the same idea for functions: `tabs`, `panel` and `messages` are
objects of accessors over the one configured adapter, which leaves `configureUi` its only export.

The linter holds it. `noRestrictedImports` rejects a deep `@mimik/ui/*` import from the apps and any
`@mimik/ui` import from inside `packages/`. `noBarrelFile`, `useComponentExportOnlyModules` and
`noDefaultExport` cover the four roots, with the shadcn primitives excused from the second since they
export their `*Variants` beside the component. `scripts/check-exports.mjs` runs after Biome in
`pnpm lint` and catches what no Biome rule can: a second exported function, a helper declared in a
component file, a second private helper anywhere else, and any re-export outside the package entry.

Three things break quietly when files move here. The root `tsconfig.json` declares its own `paths`,
which replace the ones in `.wxt/tsconfig.json` rather than extending them, so the bare `@mimik/ui`
entry has to be listed in the root config and in `apps/desktop/tsconfig.json` alike. A `vi.mock`
path is a string the refactoring tools do not rewrite; a stale one mocks nothing without failing,
and once a module is split each mock has to name the file its function now lives in —
`vi.mock('@/lib/browser-api/local-storage')`, not the folder. And `sideEffects` in the package's
`package.json` names `common/lib/dayjs-locale.ts`, because that file registers the dayjs locales by
importing them; renaming it without updating the entry lets a bundler drop the translations.

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
instead of off-screen, and nothing smaller than 60 × 30 is storable, so a single toolbar or a narrow
sidebar can be the whole area.

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
`mimik-screenshot://` scheme the app window uses and no image data crosses IPC. The preview shows the
whole capture, letterboxed, rather than filling its box: a tall area cropped to fill a wide box showed
only its top, magnified, which looked like the wrong screenshot when it was the right one.

Under the title the card says where the words came from, with the same Basic and AI badges the guide
uses, and while a description is still being written it shows that instead of a title that is about
to change. The heuristic text is known the moment the step is written; the AI rewrite arrives later
in the renderer, which sends `mimik:capture:described` so main can update the step it is holding and
the badge flips without a reload. A capture in flight shows the camera mascot with the number of the
step being taken, which is the card's loader, and hides the last screenshot while it does: with a
screenshot delay set the loader stays up for as long as the delay, and the previous step showing
through it read as the new step having been captured with the old picture. The shimmer rows under it
are built as the title and the badge row are, with the same margin, size and line height, and a
title that wraps onto its second line takes that line from the screenshot rather than from the
screen: the preview is 150 px less whatever the title adds beyond one line, which the card measures
after every render. The card is therefore one height while capturing, while the description is being
written and once any step lands, and the order stays the extension's — screenshot, title, badge row.
With hand-sized bars it came out 11 px shorter and a wrapped title made it 19 px taller, so the top
edge jumped on every step; reserving two lines for every title fixed the jump but left an empty line
under most of them. A Remove button on the
preview drops the step just taken: main keeps the recording's steps in order, asks the renderer to
delete the last one and puts the card back on the one before, so a wrong capture is undone where it
was noticed. The Ready and waiting states name the start/stop and capture-now shortcuts, read from the
settings, because the card is the one place someone looks while deciding how to begin. The header
names the capture mode while arming and recording, since a wrong mode is what spoils a whole guide;
while paused the mode picker says it instead. A pause before the first step shows the camera mascot
resting, with "Nothing is recorded while paused.", rather than a card that is only a header and
buttons.

Everything the card draws arrives as one `OverlayView` — state, region, step, mode, busy, starting
and the shortcut labels — through `view()` and `onUpdate`, rather than five positional arguments that
every new field would have lengthened.

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
click. The boundary is solid and steady while recording, dashed and grey while paused. It used to pulse,
which read as something wrong with the area rather than as "recording" — the card already says that.

The editor draws the area the way the screenshot crop tool draws its frame, so one rectangle means
one thing across the app: the outside dimmed with the same navy, purple corner brackets as the
resize grips, and invisible grips along the four edges. The edge itself is a white line with a purple
dash over it, because the area sits over whatever is on screen and a single colour disappears
against half of it — white on a light app, purple on a dark one. Its Cancel and Done live in the
standard action bar at the top, with Esc and Enter doing the same.

Where editing returns depends on where it began. From the Ready state or the tray it arms as before.
From a recording, Done carries on recording: picking Area on the paused card and pressing Enter
resumes straight away, because drawing the area is the last thing between the person and the next
step. Cancel goes back to the pause after restoring the mode that was active before Area was picked,
and the tray's editor during a recording returns to that recording either way. Picking Area mid-recording used to only save the setting, so the next steps were
cropped to whatever area was stored last with no way to draw one, and the editor's Esc sent `cancel`,
which ends a recording.

Overlays must not appear in their own capture. `setContentProtection(true)` is what keeps them out,
and **it is applied after the window is shown, never at creation**: on Windows it sets a display
affinity on the native handle, and a handle that has not been realised yet does not take it. Setting
it in the constructor looked correct and silently did nothing, which put the recording card inside the
screenshots it was displaying.

`overlay.withHidden(fn)` is the fallback for Linux, where content protection is a no-op. It hides
every visible overlay for the duration of `fn` and restores exactly the ones it hid, reapplying
protection on the way back. Hiding a window is visible as a blink once per captured step, so it is
used only where nothing else works. It waits 60 ms after hiding before running `fn`, since a grab
taken straight after `hide()` can beat the compositor and still contain the card. Grabs can overlap —
a click that closes a typing session starts two — so overlapping calls share one hide and the
windows come back when the last of them finishes. `setOpacity(0)` is
not an alternative: it stopped captures happening at all.

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
with CSS variables, because that renderer has neither React nor Tailwind. The camera-holding variant
is the same mascot dropped by `CAMERA_MASCOT_DROP` with `CAMERA_MASCOT_PARTS` over it, rendered by
`CameraMascot` in the extension's recording view and by `cameraMascot` on the card. Two renderers, one set of
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

A capture is in flight from the moment the grab starts until the capture queue is empty again, and
`overlay.setBusy` spans exactly that: the grab sets it and the recorder's `drained` hook clears it.
Finish is disabled while it holds, so a recording cannot be finalised between the screenshot and the
row that points at it. It is cleared on the queue emptying rather than on a step being written because
not every grab ends in a step — a typing session whose field turns out to hold no text is grabbed at
the moment it closes and then dropped, and clearing only on a write left the card saying "Capturing
step 4…" with Finish disabled for the rest of the recording.

`pnpm --filter @mimik/desktop check:overlay` asserts persistence, clamping, one editor per display,
controls clearing the region, whole-screen mode dropping the boundary, clicks on the bar being
ignored, and the state changes — driving Start and Pause through a real renderer
click so the preload and IPC path is covered rather than the main-process methods alone. Start is
asserted twice: the intro window opens over the capture area with the card saying "Starting…" and no
start reaching the host, and then, once the real animation has finished, the recording begins. The
card's states are asserted from the rendered DOM — the waiting prompt, the badge moving from Basic to
AI, the writing state, the capture veil and the Remove command. On Linux it
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
cannot interleave. For each click it hides the overlays, grabs the display, crops to what the capture
mode frames, and writes the result to disk. `DesktopCaptureSink` in the renderer
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

A click is the press, not the release. The hook listens for `mousedown`, and the element lookup and
the display grab both start in that handler rather than when the capture queue reaches the step.
By the release the application has already acted — the new tab exists and its close button is under
the pointer, the popup the pointer was on has closed, the skipped ad has become the next button —
and every one of those read back as a confidently wrong step name. Starting them in the queue was
the same mistake with a longer delay, because a click that lands while the previous step is still
being written waits for it. A press that turns into a drag is therefore a click as well.

The display is grabbed first and cropped last. `grabDisplay` takes the whole display under the click
and hands back a function that crops it, and the frame is chosen only afterwards, so neither a
window lookup nor a delay sits between the press and the picture.

A click frames the window **under the pointer**, looked up at the press through `windowAt`, not the
window in front. The foreground moves only once the clicked application has handled the press, so a
foreground read soon after it still names the application clicked before — with two windows side by
side, every switch between them read the other one, whose rectangle does not hold the click, and the
step fell back to the whole screen. The window under the pointer is the one being clicked by
definition. Typing and key steps have no pointer to go by, so they still read the focused window,
after the grab and at least the settle delay after the key, which runs beside the grab and costs the
screenshot nothing.

The card itself is not focusable, so clicking Pause or Finish never makes the app frontmost and never
changes what active-window mode will frame next. The region editors stay focusable because they read
Enter and Escape; the card has no keyboard of its own to lose.

What a capture frames is `captureMode`'s decision, and `frameFor` owns it: the window's bounds, the
whole display under the cursor, or the drawn region. The window rectangle is resolved on
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

The lookup starts on the press and is awaited after the grab, so it overlaps the settle delay and
the screenshot instead of adding to them. That it runs early is not only for speed:
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

`edits.zoomAuto` says whether that level came from Automatic or was picked, because the number alone
cannot: a 1200 px window on Automatic and the same window at a picked 1.5× store the same level. The
guide's Zoom control reads it back through `currentZoom` and names the choice on its button and tick
— Automatic, a level, or nothing when the steps disagree — where it used to say only "Zoom" and open
on Automatic whatever the guide held, which read as the setting having been ignored. A step saved
before the flag existed counts as Automatic when its level equals the automatic one for its width,
and picking a level equal to that is still written, so the flag follows the choice. The crop tool
clears it along with the level.

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
in the accessibility tree. That is the whole reason there is no
keycode table, no layout handling, no dead-key state and no IME composition tracking in this
codebase — the machinery those need exists to answer a question we do not ask.

A session opens on any key that is not a modifier, not `Enter`, `Tab` or `Escape`, and not held with
`Ctrl`, `Alt` or `Meta`, and every such key also appends to a buffer of what was typed. It closes on any of those, on a click, on pause, on stop, or after 1200 ms
with no keys. `Shift` plus a letter still counts as typing, which is why modifiers are tested
individually rather than as a set.

When the value is read depends on what closed the session. The idle timeout and `Enter`, `Tab` or
`Escape` read it then, because the field still has focus and the last keys are only in the live
value. A click, pause, stop or capture-now reads a snapshot instead: 400 ms after each key the
focused element is read again, because by the time a click closes the session the focus has moved
to whatever was clicked — a search suggestion, say — and a read then finds no text field and drops
the step. A key typed after the snapshot makes its value stale, so the snapshot still says which
field it was but the text comes from the keystroke buffer. No snapshot at all, a click within
400 ms of the first key, falls back to reading at the close.

Whichever read it is starts when the session closes, and so does the typing step's grab, which
follows the field read so it frames the right display. Neither waits for the queue. `Enter` in a
browser's address bar is why: by the time a queued read ran, the page had navigated, focus had
moved to the document, and the step named the new tab page and photographed its wallpaper.

Closing a session does not guarantee a step. The focused element is read first, and nothing is
written unless it is a text field with something to show for it. A password field is the exception
in the other direction: it reports no value by design, and the step is written anyway with no
`inputValue`, worded "Type password" rather than naming any contents.

Keys that are not typing get their own step, unless `recordKeys` is off. A shortcut always does; `Enter`, `Tab` and `Escape` do
only when no typing session was open, because the `Enter` that submits a field is part of that
field's step rather than a step of its own. Auto-repeat is collapsed the way a double click is —
`isRepeatKey` drops the same keycode within 500 ms, so holding a key down is one step.

Naming the key is the only place a keyboard layout is consulted. `keyLabel` maps the hook's scancode
through `MapVirtualKeyExW` against the **foreground window's** layout, so the same physical key reads
as `Q` on QWERTY and `A` on AZERTY, which is what the application being recorded will have acted on.
`ToUnicodeEx` is deliberately not used: it would name punctuation too, but it mutates the thread's
dead-key state as a side effect, and a shortcut only needs the letter, digit or named key. A key that
maps to none of those yields no label and therefore no step, rather than a step nobody can follow.

Two sources compete for the text and `typedTextFor` picks between them. The field's value wins
by default, because it is what is actually on screen and it survives caret movement, selection and
autocomplete; turning `readFieldText` off skips that read entirely and always uses the buffer. The
keystroke buffer wins in three cases: the focused element reports no value, the value is empty, or
the field holds more than was typed by a margin that depends on its type — 24 characters for a
document, 120 for anything else. That last rule is what makes rich text work — in a word processor
the "field" is the whole document, so its value is the entire text rather than the sentence just
typed, and the buffer is the only thing that knows which part is new. A document gets the small
margin because holding text beyond this session is what a document normally does, while a single
field holding far more than was typed is the exception. A non-text role yields nothing at all, so a keypress in a file manager is not a
step.

Building that buffer is the only place a keystroke becomes a character. `resolveKey` runs
`ToUnicodeEx` against the foreground layout with the modifier state the hook reported and the real
caps-lock state, and appends what comes back; `Backspace` removes one. Dead keys fall out of this
for free: `ToUnicodeEx` returns nothing for the accent itself and the composed character for the key
after it, because it keeps that state per thread and every keystroke goes through the same one. The
cost is that the state is real and can be left armed, so `clearDeadKey` flushes it whenever a
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

A step is written with its heuristic description immediately and, when a provider key is saved,
with `aiPending` set; then it is rewritten when the model answers. Saving a key is what enabling AI
means here, so without one the flag is never set and nothing on the card claims a description is
coming. With one, the flag is cleared **whichever way the request goes** — a miss and a failure both
clear it — because a pending flag that only clears on success is the same trap as a title
placeholder that only resolves with AI.

Stopping a recording names the guide twice. The application name lands first so the view never opens
on a placeholder, and `generateGuideMeta` replaces it if a key is configured. Ordering it that way
means the guide is always named, and the AI title is an improvement rather than a prerequisite.

Step descriptions are only as good as the element lookup. `buildFallbackDescription` picks the verb
from the role — a text field is entered, a combo box, radio button or menu item is selected, anything
else is clicked — and quotes the name it finds. A desktop typing step quotes what was typed instead,
`Type "…"`, collapsed to one line and cut at 200 characters, because the text is the instruction
and the field is usually obvious from the screenshot; the extension still names the field. The name
is the accessible name first; a text field
then falls back to its placeholder and help text but never its value, which is what was typed into
it, and the machine identifier is used only when it does not read as one. An element with no name of its own borrows one: a group or pane from the first named control
inside it, anything else from its nearest named ancestor, stopping at the window, because naming
the window as the click target would be wrong. Chrome's internal window class names and bare numbers
on panes are discarded, since the accessibility tree reports both as names, and invisible format
characters are stripped from every name — web pages wrap words in direction isolates and
zero-width marks that the PDF font draws as boxes. When nothing is left the
step reads "Click here" rather than "Click treeitem" — the control type is not a name. A
`screen`-sourced recording, with no lookup at all, is every step reading "Click here".

The AI rewrite runs only when a provider key is saved, which is what enabling AI means here, and
the step it rewrites is marked `ai` so the badge says so.

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
does not, so the gear exists here and only on the library route. Moving it brought `SearchModal`,
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

Pressing Start Capture opens `CaptureSheet` rather than arming immediately. Esc closes it, as it does
every dialog; the sheet is a panel of its own rather than the shared dialog, so it listens for the key
itself. The sheet is where the
capture mode is chosen, because the mode decides what every screenshot in the guide will frame and
that is worth one deliberate choice before recording rather than a control discovered afterwards.
Picking a mode writes `captureMode` straight through to `capture-settings.json`, so the sheet reopens
on whatever was used last and the recording bar's own picker reads the same value.

The sheet holds the mode and nothing else. `keepClicksBeyondArea` was tried there and taken out: read
beside a rectangle the user has just chosen, an option that falls back to the whole screen reads as
undoing that choice, when what it really decides is whether a click outside the rectangle is dropped
or kept. It stays in Settings, where there is room to say so. Nothing in the sheet is editable in two
places.

Starting in Area mode opens the region editor first and arming happens when the rectangle is
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

The settings that only a desktop capture needs live in `capture-settings.json` beside the region,
read by main rather than by core, because none of them mean anything to the extension.

| Setting | Default | Effect |
|---|---|---|
| `captureMode` | `window` | What each screenshot frames: the focused window, the whole screen, or a drawn area |
| `showCursor` | on | A pointer is drawn into the screenshot at the click point |
| `screenshotDelayMs` | 0, capped at 2000 | Extra wait between the click and the grab |
| `keepClicksBeyondArea` | off | Whether clicks beyond the capture area are recorded at all, in `region` mode only |
| `recordKeys` | on | Whether a shortcut or a named key becomes a step |
| `recordTyping` | on | Whether typing becomes a step |
| `typingDebounceMs` | 1200, clamped to 200–5000 | Quiet time that closes a typing session |
| `readFieldText` | on | Off means the keystroke buffer is used and the field's value is never read |
| `zoomLevel` | automatic | How far a step zooms toward the click: `null` derives it, or 1–5 in 0.25 steps |
| `shortcuts` | three accelerators | Global keys for start/stop, pause/resume and capture now |

`normaliseSettings` runs on every read and write, so an out-of-range delay clamps and an unknown
mode falls back rather than reaching the recorder, and a key it no longer knows is dropped. It also reads four
settings under the names an earlier build saved them as, so a file written before the rename keeps
its choices; the next save writes only the current names.

The pointer drawn is always the arrow. A choice of arrow, hand or dot used to sit under "Show the
cursor", and it only changed anything with that switch on and only on left clicks, so it was a
setting nobody could see working. `CursorMark` stays core's type, and `drawCursor` still draws all
three shapes, because steps recorded while the choice existed carry the other two in `edits.cursor`.

The marker colour is not in that file. It is `targetColor` in the renderer's settings storage, the
same key the extension's brand colour uses, because the renderer is where both readers are: the
capture sink stamps it on each step's dashed target, and `branding.ts` takes it as the accent of
every export. Setting it on the desktop therefore recolours exports too, which is what it does in
the extension. The two surfaces keep separate stores, so neither one's choice reaches the other.

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
Matching on position as well would separate them, and that was tried and dropped: a position check
needs a distance tolerance, and one that fits a 1× display is wrong on a 2× one, while time alone
needs no tuning.

A click outside the capture area, when that setting keeps it, is still framed by the area: the area is
what the guide is about, and a step that suddenly shows the whole screen reads as a mistake. The grab
comes from the display the area is on rather than the one the click landed on, so the crop is right
across monitors. `shouldCapture` is exported for that
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
`AiSettings` already had, with a line under the title saying what the card is for. Rows inside a
desktop card are `Row`: label and a one-line hint on the left, the control on the right, divided
from the next row, or the control underneath with `stack` when it is too wide to sit beside the
label. The AI card keeps the stacked 11px labels it needs in 400px of side panel — the two are never
on screen at once, and matching them would mean branching that shared component on `client()`.
Capturing is three cards: Screenshots, Click marks and Typing and keys.

Each kind of value has one control, and it shows the value rather than hiding it behind a click. A
choice among a few is `Segmented`, a row of buttons with the chosen one filled; that is the capture
mode and the zoom, which offers Automatic, 1×, 1.5×, 2×, 3×, 4× and 5× and adds the stored level as one more
button when an older build saved one in between. An on/off is `Switch`, the same switch the AI card's
own-server toggle is, moved into `packages/ui` so the two cannot drift. A duration is `Slider`, a
native range input tinted with `accent-accent` beside a chip reading the value in ms or seconds,
because a number field hid what the default was and drew spinner arrows on Windows. The marker colour
is the extension's control, a swatch and hex code that opens the shared `ColorPicker` with core's
`TARGET_COLORS` as presets. A setting that cannot apply is disabled rather than hidden, so the rows
do not jump: outside clicks without Area mode, the field read and the typing pause without typing.
Every change is applied to the page before main answers, or a slider dragged across its range would
lag a round trip behind the pointer.

Settings opens as a dialog over the library, not as a page. It is the shared `Dialog` laid out the
way the export preview lays out its own: a title bar with the close button, the section list down
the left and the section scrolling beside it, 880 px wide and at most 650 px tall. As a page it
replaced the library, and on a wide window its content, which tops out around 620 px, sat in a field
of empty space. The dialog also covers the header, which retired `TopNav`'s `onNavigate`: that prop
existed only to close the old pane when All Guides, Starred or Trash navigated underneath it.
`SettingsPanel`, the body, mounts only while the dialog is open, so it reads the settings each time it
opens and shows a mode the capture sheet or the recording card changed in the meantime.

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
picker have no desktop meaning, and it reaches into `@/lib/browser-api/`. Splitting it did mean the
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

Starting, from the card or the shortcut, plays the extension's start animation first, and the
recording begins when it ends. The overlay opens a click-through, content-protected window over what
is about to be framed — the region, the focused window or the display, the same `frameFor` decision a
capture makes — and that window calls core's `showStartNotification`, so both surfaces run one
animation from one module. The host hears `start` only after the animation's `animationend`, which
is the ordering the extension uses too: nothing clicked during it is recorded, so the animation never
lands in a step, including on Linux where content protection does nothing. Closing the card during it
cancels the start. A six-second limit ends a stalled intro rather than leaving the recording unstarted.

Capture-now writes an ordinary click step at the cursor. There is no separate action for it: the
point of pressing it is that the cursor is already on the thing worth capturing.

The keystroke that drives a shortcut must not also be recorded as one. Without that check, pausing a
recording writes "Press Alt+Shift+P on Mimik" as a step, which is both wrong and confusing, and
resuming writes another. `isBoundShortcut` compares a keystroke against each configured accelerator
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

All colors are defined as CSS variables in `packages/ui/src/global.css` and used via Tailwind classes:

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
