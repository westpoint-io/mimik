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
| `name` | `name` attribute | `AXTitle` | `Name` |
| `textContent` | trimmed text | `AXValue` / `AXSelectedText` | `Value` |
| `ariaLabel` | `aria-label` | `AXDescription` / `AXARIAValueText` | `HelpText` |
| `placeholder` | `placeholder` | `AXPlaceholderValue` | `Placeholder` |
| `altText` | `img.alt` | `AXHelp` | `HelpText` |
| `rect` | `getBoundingClientRect()` | `AXPosition` + `AXSize` | `BoundingRectangle` |

A fourth source, `screen`, knows only where the click landed: it fills `rect` with a fixed box around
the click point, `clickPoint`, `devicePixelRatio`, `app` and `window`, and leaves every identity field
null.

`tag`, `cssSelector`, `href`, `inputType` and `dataTestId` are DOM-only and absent elsewhere.
`app` and `window` are the reverse — desktop only.

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

`apps/desktop/src/main/capture` holds the four things a desktop capture needs. Only one comes from
Electron; the other three are prebuilt npm packages rather than a crate we maintain.

| Primitive | Source | Native |
|---|---|---|
| Displays, DPI, cursor | Electron `screen` | no |
| Screenshot of a display | `node-screenshots` | prebuilt |
| Focused foreign window | `get-windows` | prebuilt |
| Global clicks and keys | `uiohook-napi` | prebuilt |

Screenshots do not go through Electron's `desktopCapturer`. That route asks the xdg desktop portal
on Wayland and fails outright when the portal does not answer, and it was returning frames that
decoded to nothing on Windows. `node-screenshots` talks to each platform's own capture API, so it
has a Wayland path and needs no portal. Monitor identifiers there have nothing to do with Electron
display ids, so the monitor is resolved from a point inside the display's bounds rather than matched
by id.

Anything richer than these four — the accessibility tree in particular — needs an addon we build and
maintain ourselves, and that is a separate task.

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
`screen-saver` level:

| Window | When | Input |
|---|---|---|
| Editor, one per display | `editing` | interactive — drag to draw, move or resize |
| Boundary, sized to the region | `armed`, `recording`, `paused` | click-through |
| Controls bar | `armed`, `recording`, `paused` | interactive |

Editing puts a full-display window on **every** display rather than only the one holding the region,
which is what makes moving the region to another monitor work: each editor converts client to screen
coordinates with its own display origin, and whichever one you draw on wins. Outside editing the
boundary shrinks to the region itself and takes `setIgnoreMouseEvents`, so recording never swallows a
click. The boundary is solid and pulses while recording, dashed and grey while paused.

Overlays must not appear in their own capture. `setContentProtection(true)` handles that on macOS and
Windows but is a no-op on Linux, so `overlay.withHidden(fn)` hides every visible overlay for the
duration of `fn` and restores exactly the ones it hid — the capture pipeline wraps its screenshot in
it, and that is the only mechanism that holds on all three platforms.

`pnpm --filter @mimik/desktop check:overlay` asserts persistence, clamping, one editor per display,
controls clearing the region, and the state changes — driving Start and Pause through a real renderer
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

`elementSource` is `'screen'` for these steps: the click point, the region-relative target rect, the
display scale factor, and the foreground app and window title are all known, but nothing about the
control under the cursor is. Reading that needs the accessibility tree and is a later task.

`DesktopRecorder` takes the display grab as a constructor argument defaulting to `captureDisplay`, so
`check:pipeline` feeds it a generated frame. The crop arithmetic, the sink, the step write and all
four document exporters then run without a working screen-capture path, which matters because a real
grab depends on the machine it runs on. Whether a real grab works is `check:capture`'s question, not
this one's.

`pnpm --filter @mimik/desktop check:pipeline` captures two clicks into a throwaway guide, then
asserts the steps landed on the guide, the screenshot is cropped to the region, the description came
from the shared heuristic, and HTML, Markdown, PDF and DOCX all export non-empty. It then loads the
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

Step descriptions read as bare actions until the accessibility tree lands. A screen capture knows
where the click was and which application owned it, so `buildFallbackDescription` has no control
name to work with and every step reads the same.

## Capture Settings

Three settings that only a desktop capture needs live in `capture-settings.json` beside the region,
read by main rather than by core, because none of them mean anything to the extension.

| Setting | Default | Effect |
|---|---|---|
| `showCursor` | on | A pointer is drawn into the screenshot at the click point |
| `cursorStyle` | `arrow`, `dot` on Linux | Which pointer shape gets drawn |
| `screenshotDelayMs` | 0, capped at 2000 | Extra wait between the click and the grab |
| `captureOutsideClicks` | off | Whether clicks beyond the capture area are recorded at all |

`normaliseSettings` runs on every read and write, so an out-of-range delay clamps and an unknown
cursor style falls back to the platform default rather than reaching the recorder.

Electron exposes no way to read the real system cursor bitmap and a screen grab never includes the
pointer, so the shapes are drawn as canvas paths. The cursor is an entry in `edits` beside the click
target, not something baked into the stored bytes, so `renderScreenshot` draws it and every exporter
and the editor show it with no export-side work. Keeping it out of the file means the capture is
never decoded and re-encoded on the way to disk, and the pointer can be moved or removed later
without touching the original.

A click outside the capture area cannot be framed by a region that does not contain it, so those
captures fall back to the whole display the click landed on. `shouldCapture` is exported for that
decision rather than being inline in the hook handler, so the rule is testable on its own.

`check:pipeline` covers all four: clamping and persistence round-trip through the real file, the
opt-in rule holds in three positions, a 400 ms delay measurably slows the grab, and the same
synthetic frame renders to a different size once a cursor is drawn over it. It restores whatever
settings were on disk when it finishes.

## Export Formats

| Format | Generator | Details |
|--------|-----------|---------|
| HTML | `core/export/html-export.ts` | Self-contained, base64 images, inline CSS |
| PDF | `core/export/pdf-export.ts` | jsPDF, A4 portrait, auto page breaks |
| Markdown | `core/export/markdown-export.ts` | Standard MD with base64 image data URLs |
| DOCX | `core/export/docx-export.ts` | Lazy-imported, Word-compatible |
| Video | `core/export/video-export.ts` | WebCodecs via mediabunny (lazy), mp4/H.264 with WebM/VP9 fallback |
| GIF | `core/export/gif-export.ts` | gifenc (lazy), same frame timeline as the video; user picks Small/Medium/Large from `GIF_SPECS` |

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
