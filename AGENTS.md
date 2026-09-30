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
└── capture-native/      the accessibility addon, UIAutomation on Windows and AX on macOS, in Rust
apps/desktop/src/
├── main/                Electron main: window, tray, capture pipeline, overlay windows, shortcuts
├── preload/             the contextBridge API
└── renderer/            the app window, the overlay renderer, settings/, ai/ and the checks
scripts/                 repository checks that pnpm lint runs
```

## State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Capture lifecycle | xstate | State machine (IDLE ↔ RECORDING ↔ PAUSED) in background service worker |
| Fullview UI | Zustand | Search modal, guide counts, active guide data |
| Persistence | Dexie (IndexedDB) | Guides, steps, screenshots, snapshots, cached voice clips, narration transcripts |
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
| Onboarding | `entrypoints/onboarding/` | First-install wizard: AI setup, narration, smart blur, pin extension, star |
| Options | `entrypoints/options/` | Settings page (shared SettingsView in centered card) |

## Messaging

```
Content Script ←→ Background Service Worker ←→ Sidepanel / Fullview
```

**Extension messages** (webext-core, `lib/messaging.ts`):
- `getState` → current capture state, step count, guide ID
- `startRecording({url})` → creates guide, returns guideId
- `stopRecording()` → finalizes guide, generates AI title
- `pauseCapture()` / `resumeCapture()` → RECORDING ↔ PAUSED, plus the stop/start broadcast
- `enterBlurMode()` / `exitBlurMode()` → the same pause, with the blur overlay and `pauseReason: 'blur'`
- `captureStep({guideId, action, elementMeta, domContext})` → screenshots + creates step
- `updateInputStep({stepId, description})` → updates typing step description
- `finalizeInputStep({stepId, elementMeta, domContext})` → final screenshot + AI description

**Tab messages** (content script ↔ background, `lib/tab-messages.ts`):
- `PING` / `START_CAPTURE` / `STOP_CAPTURE` — lifecycle
- `SHOW_NOTIFICATION` — "Recording started" overlay
- `URL_CHANGED` / `GET_ROUTE` — SPA navigation tracking
- `START_BLUR` / `DISMISS_BLUR` / `CLEAR_BLUR` — blur overlay: open, close keeping masks, close removing masks

**Frame messages** (content script in a subframe ↔ content script in its parent, `window.postMessage`, `core/capture/dom/frame-placement.ts`):
- `mimikFramePlacement: 'ask'` / `'answer'`: where a subframe's viewport sits in the tab, so its rects can be moved into screenshot coordinates

## Capture Pipeline

**Start recording:**
1. User clicks "Start capture" in sidepanel
2. Background transitions xstate machine IDLE → RECORDING
3. Creates Guide in IndexedDB, broadcasts `START_CAPTURE` to all tabs
4. Content scripts create CaptureSession → CaptureController (event listeners)
5. Shows recording notification overlay on active tab

**Capture a click:**
1. Content script's CaptureController detects click via DOM event listener
2. Click handler pushes async work into PQueue (concurrency: 1). An ordinary click is cancelled and replayed once the screenshot is taken (`click-intercept.ts`); text fields, native dropdowns, toggles outside a menu, shift-clicks and untrusted clicks pass through
3. Enqueueing hides the hover ring (`pointerdown` already did, on mouse paths); queue waits 3 frames, and in a subframe for the frame's placement in the tab, then sends `captureStep`
4. Background calls `captureVisibleTab` (ring is hidden; the page hasn't reacted yet, except to a toggle, which is shot after it flips)
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
3. Background waits for narration to settle (30s cap) and drains queued step descriptions (20s cap), then generates the guide title from step descriptions + URLs via AI
   - With no AI key the domain fallback title is written straight away. The narration wait, the drain and the `aiPending` cleanup still run, just after the title
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

## Narration transcript (`core/capture/voice/`)

Attribution is a guess, so the words are kept independently of it. `assignSegments` returns a
`TranscriptLine` for **every** segment the transcriber returned — the ones a step took, the ones
nothing claimed (`stepId: null`), and the ones `rejectReason` threw away, with the reason on the
line. `runNarrationPipeline` collects them into `NarrationResult.transcript`, stamped with the audio
slice's `audioEpochMs`, and `applyNarration` in the background writes that to the `transcripts`
table (Dexie `version(4)`) *before* it applies anything to steps — a recording where nothing was
attributed is exactly the case this exists for, and it writes no step at all, so `saveTranscript`
announces itself on the guides channel rather than relying on `applyNarrationToSteps` to do it.

`VOICE_RESULT` carries an explicit `final` flag, and `applyNarration` reports `idle` and settles the
pending promise only on that flag. It used to infer finality from `transcribingGuideId`, which the
background sets *after* `stopVoiceCapture` resolves — but the host calls `deliver()` synchronously
whenever there is nothing left to transcribe (no steps, or every second already flushed), so the
result could arrive first, be read as a mid-recording flush, and leave the panel spinning on
`'transcribing'` forever. That is why the guide claims the transcription and calls
`markNarrationPending()` *before* awaiting the host, and releases both if the host refuses.

One row per transcribed slice, because mid-recording flushes land separately from the tail.
`flushedUpToSeconds` in the voice host guarantees the slices never overlap, so `mergeTranscripts`
(`core/guides/transcript.ts`) can order them by wall clock with nothing to de-duplicate. The
`epochMs` on each row is what makes that possible: a flush slice's seconds are relative to its own
start, not the recording's.

`Step.narratedDescription` holds what narration heard, verbatim. `applyNarrationToSteps` writes it,
and only `deleteTranscripts` clears it, so an edit replaces `description` and leaves it, and `restoreNarratedDescription`
can put the spoken text back with its `narration` source. That is the whole answer to "an edit
overwrote what I said": the step editor offers the restore only while the two actually differ.
The reverse holds too: narration that lands on a step the user already edited (`manual`) writes only
`narratedDescription` and leaves the edit alone. Speech from a later slice about a step an earlier slice
already narrated (words after the final click, or after a resume with no new click) is appended to what
that step said rather than replacing it: `applyNarrationToSteps` takes the slice's `epochMs` and appends
when the step was captured before it. A stop still hands the transcriber every step, because the host
skips transcription entirely when it is given none, and the tail would never reach the transcript.

The dashboard's transcript panel is the answer to the other half. It shares the side-panel column
with version history, so the store keeps them mutually exclusive, and the top bar's button only appears
when `hasTranscript` says there is one — which is re-read on every guide reload, because transcription
is still running when the dashboard opens after a recording. An unattributed line offers to append
itself to the nearest step: `nearestStepId` looks **forward** first, since onboarding asks users to
say what they are about to do and then do it. Accepting that writes the step onto the line
(flagged `addedByHand`) as well as into the description, so the line reads as
used from then on and a second visit to the panel cannot append the same words twice.
`addTranscriptLineToStep` does both writes in one Dexie transaction, and re-reads the line inside it:
done separately, a throw between them left the words in the step with the line still reading unused,
and a double click appended them twice. Restoring that
step's spoken original deletes the appended sentence, so `restoreNarratedDescription` releases the
lines it just wiped out and they return to unused — otherwise the panel would claim a step still
carries words it no longer has, with no way left to re-add them. Only hand-added lines are released;
an attribution narration made itself is a record of what the pipeline decided and stays put.

Privacy is the cost of keeping this. A verbatim transcript is more sensitive than per-step text —
smart blur cannot reach speech, so a password read aloud lands in it as plain text. It is therefore
local-only: never in an exported guide, deletable on its own from the panel — which also clears
`narratedDescription` from the steps and from the snapshots that copied them, so “gone for good” is
true — and swept by `permanentlyDeleteGuide` alongside snapshots. Clearing `narratedDescription` is
not enough on its own: a step narration wrote holds the same words in `description`, and descriptions
go into every export while transcripts go into none, so `forgetSpokenWords` also puts any step still
sourced `narration` back on its rule-based text (`buildFallbackDescription`, source `heuristic`), and
strips the sentences an `addedByHand` line pushed into a step — those are stamped `manual`, so the
source alone would have left verbatim speech behind. On a step that carried spoken text (it has a
`narratedDescription`) it strips that spoken prefix and any trailing sentence matching a line that is
unclaimed or claimed by the same step, because a snapshot can hold a line that
`restoreNarratedDescription` has since released. A step narration never touched loses only its own
`addedByHand` lines, and is otherwise left alone, whatever its text happens to end with.
`duplicateGuide` copies the transcript rows onto the copy's step ids, so a copy that carries spoken
text can still delete it, and `bundleStep` drops `narratedDescription` so a `.mimik` file never carries
it. `mergeGuideInto` re-keys transcripts onto the
guide it merges into and records the redirect in the `guideMerges` table (Dexie `version(5)`, swept by
`permanentlyDeleteGuide`), and
`saveTranscript` resolves the owning guide before it writes — by the guide a line's step now sits on,
or by walking that redirect chain — because an insert-recording deletes its staging guide before
narration lands, and a slice where nothing was attributed has no step to resolve through. The
redirect is a table and not module state in `core/guides/service.ts` on purpose: the only path that
reads it is the tail transcription after a merge, and MV3 evicts the background worker after about 30
seconds idle, so an in-memory redirect dropped the transcript with no error and no retry. Stripping the spoken text rewrites the stored
snapshot steps, so `deleteTranscripts` recomputes each `contentHash` too, or version history would
stop collapsing two identical saves into one row. Nothing was added to any export path, and nothing
should be.

What is *not* recoverable: speech the energy gate never detected, and a mis-transcription. Both need
the audio, and the audio is released at `recorder.stop()`. Keeping it is still a separate bet (see
the voice-over section) — what the transcript buys is the paid-for text that used to be thrown away
between the API response and the step write.

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

The window also hides the moment a capture begins — Start in the sheet or the
start shortcut — so Mimik never records itself, and it comes back when the guide is finished, or on
Cancel when it was open beforehand. Its renderer keeps full speed while hidden, because it is the
one writing every step. The tray icon carries a red dot for as long as a recording runs, and clicking
it then finishes the recording rather than opening the window. Its menu is All guides, Start capture and
Settings, each opening the window on that place in the words the app already uses for it, then the
version, greyed out, and Quit Mimik. Start at login and Check for updates live in Settings, and
drawing the area in the capture sheet, so the menu repeats neither.

The YAML loader in `electron.vite.config.ts` writes the word "import" inside locale strings as
`\u0069mport`. electron-vite's CommonJS shim is inserted after whatever its pattern takes for the last
`import` statement, and the phrase "file to import" in a locale string was taken for one, which put
the shim inside the string and broke the main build. JavaScript reads the escape back as the same
word.

`pnpm dev:desktop` runs it, `pnpm build:desktop` compiles, `pnpm pack:desktop` produces an unpacked
app in `apps/desktop/dist`. The root script calls it with `run`, because `pnpm --filter … pack` is
pnpm's own command: it wrote a tarball of the package and never built the app. `electron-builder.yml`
targets dmg/zip, nsis and AppImage/deb, and `executableName` must stay set or the binary inherits the
scoped package name. It is `Mimik`, capitalised, because electron-builder names the Windows install folder,
the `.exe` and the uninstaller after it; Linux keeps `mimik`. `extraMetadata` renames the packaged app to `mimik`, display name `Mimik`, for the
same reason: under `@mimik/desktop` the installer put it in `Programs\@mimikdesktop`, and at runtime
it took the dev copy's name and so its settings and guides. Windows installs through the NSIS wizard,
not one click: who to install for, the folder, and a Run Mimik box at the end, with
`resources/installerSidebar.bmp`, the mascot on navy, beside the Welcome and Finish pages. The file is
`Mimik-<version>.exe`.

The installer carries `THIRD_PARTY_NOTICES.txt` and Mimik's own `LICENSE.txt` beside the executable,
where Electron already puts `LICENSE.electron.txt` and `LICENSES.chromium.html`. Nearly every
dependency's licence, MIT included, asks for its notice to travel with any copy, so the file is written
on every build rather than kept by hand: `scripts/third-party-notices.ts` is a renderer plugin that
lists each package the bundle pulled in, walks the `node_modules` electron-builder copies from the
app's dependencies, adds the addon's runtime Rust crates from `cargo metadata` whenever the Windows
addon is built, and appends two texts no package ships, kept in `apps/desktop/licenses/`: libuiohook's
LGPL-3.0, which `uiohook-napi` compiles into its prebuilt binary, and the MIT notice of the LobeHub
provider logos. The LGPL is satisfied because that binary is a separate file a user can replace with
one built from its public source. `check:pipeline` fails if the file stops naming what ships.

The app icon is the extension's, `public/icon.svg`, so the two products share one mark.
`resources/icon.png` is it at 1024 px, which electron-builder turns into the macOS and Linux icons,
and `resources/icon.ico` holds 16 to 256 px drawn from the vector rather than scaled down from the
large one, so the taskbar sizes stay sharp. The main window sets it too, which is what puts it in the
taskbar in dev and on Linux. They are renders, so a change to the SVG means redrawing both:
`rsvg-convert -w 1024 -h 1024 public/icon.svg -o apps/desktop/resources/icon.png`, and each ICO size
the same way combined with `magick`.

## Desktop Capture Primitives

`apps/desktop/src/main/capture` holds the five things a desktop capture needs. One comes from
Electron, three are prebuilt npm packages, and only the last is a crate we maintain.

| Primitive | Source | Native |
|---|---|---|
| Displays, DPI, cursor | Electron `screen` | no |
| Screenshot of a display | `node-screenshots` | prebuilt |
| Focused foreign window | `@mimik/capture-native` on Windows and macOS, `get-windows` elsewhere | ours / prebuilt |
| Global clicks and keys | `uiohook-napi`; the addon's event tap on macOS | prebuilt / ours |
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

Windows and macOS. `is_supported()` answers false on Linux and `elementAtPoint` resolves to null,
so the app, the checks and the recording pipeline all behave the same as when the binary is simply
missing.

On macOS, `mac.rs` is the same six calls against the accessibility API, bound by hand to
CoreFoundation, ApplicationServices, CoreGraphics and Carbon rather than through binding crates,
since the calls are few and each crate would pin its own copy of the CoreFoundation types. The hit
test is `AXUIElementCopyElementAtPosition` on the system-wide element with a one-second messaging
timeout. It answers the other way round from UIAutomation: with the deepest element, so a click on
a button's label returns the label's static text. A text or image hit is therefore promoted to the
nearest control within three parents — button, link, menu item, tab, row, cell and the toggles —
and anything else is left as it is. Chromium and Electron build their accessibility tree only when
something asks, so the first hit in an application sets `AXManualAccessibility` on it, once per
process, and repeats the hit test; other applications refuse the attribute and nothing changes. A
hit that lands on Mimik's own overlay answers null rather than naming the card. The accessible name
is `AXTitle`, then `AXDescription`, then the value of `AXTitleUIElement`, which is how a text field
names its label; the placeholder rides in the help text, and a password is `AXSecureTextField`,
whose value is never read. `macmap.rs` holds the role table and the key tables with no FFI in them,
so they are tested on Linux beside `hit.rs`.

Windows on macOS come from `CGWindowListCopyWindowInfo`, front to back, keeping layer 0 only: menus,
popovers and the menu bar sit on higher layers, so a click in a dropdown frames the window under it
without any popup rule, which Windows needs because its menus are top-level windows. The
frontmost window is the first one owned by `AXFocusedApplication`. The app name is the window's
owner name and the path is the `.app` bundle around `proc_pidpath`. Points are Quartz points with
the origin at the top left of the main display, which is exactly Electron's DIP, so none of the
Windows conversions run. Titles need Screen Recording, and without it they come back empty.

The hook's keycodes are libuiohook's PC scancodes on every platform, so `mac_keycode` maps them to
macOS virtual keys before `UCKeyTranslate` reads the current layout. `keyLabel` tries the key bare
and then shifted, because the AZERTY number row only gives a digit with Shift. `resolveKey` keeps
the dead-key state in an atomic between calls, and `clearDeadKey` zeroes it. The layout calls stay
synchronous because Text Input Sources must be read on the main thread, which is where Electron's
main process runs JavaScript. On a Mac, Option is how people type accented letters and symbols, so
`isTextKey` counts an Option key as typing there, and `comboLabel` names the modifiers Cmd and Option.

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
`annotation`, `branding`, `common`, `export`, `guide`, `history`, `library`, `navigation` and `search`. Inside a
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
`src/renderer/core-env.ts` for its side effect, exactly as the extension imports `src/lib/core-env.ts`
— the app window, the overlay and the splash alike. The desktop adapter backs settings with
`window.localStorage` and translates through the same six locale files the extension ships.

Which one is the App language setting under General — the language picked there, or the system's
when it is left on "Same as the system" — resolved by `appLocale` from `navigator.language`, matching
a region to its language (`pt-PT` to `pt-BR`) and falling back to English. A key a locale lacks falls
back to English on its own rather than showing the key. The value is read synchronously when
`core-env` loads, so changing it stores it, reloads every window through `mimik:app:relocalise`, and
reopens the settings on General in the window that asked. The extension has no picker, because
`browser.i18n` follows the browser's own language and cannot be switched at runtime.

The main process translates the tray, its menu and the dialogs through `mainI18n`, which bundles the
same six locale files. It cannot use core's `translate`, since main may only take types from core,
so it keeps its own dozen-line lookup, with the same English fallback per key. Main has no
`localStorage`, so it cannot read the chosen language: it starts on the system's, matched to a
supported language, and the app window reports the one it resolved as soon as `core-env` loads,
through `mimik:app:locale`, which also rebuilds the tray menu. Picking a language reloads every
window, so the report follows the choice.

The overlay and the splash have no React, but they read strings through `i18n.t` like everything
else, and wherever the extension already names a thing they use its key: the card's header is
`recording.recording` / `recording.capturePaused`, its Remove button `recording.deleteStep`, its
badges `stepSource.*`, its step line
`export.stepLabel`, and the area editor's buttons `common.cancel` and `annotationEditor.done`. They
had been hand-typed English — "Remove this step", "Paused", "Writing step description…" — so one
action read differently in the side panel and on the card, and a desktop key existed for half of
them that nothing read. Copy the extension has no counterpart for (the card's tips, "Starting…",
"Capturing step N") is still written in the overlay.

`pnpm --filter @mimik/desktop check:storage` runs four checks across two hidden `BrowserWindow`s:
the upgrade from a real v1 store to the current version, `MimikDB` opening at v5 with all seven tables, a guide
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
uses. The renderer sends `mimik:capture:described` when the AI text arrives, and main updates the
step it is holding. There is no "writing" line, shimmer or collapsed pill — a step used to go through
two loaders, one for the screenshot and a second for the description.

The one loader is the camera mascot printing a photo, over the whole of the preview, title and badge
rows so the card keeps its height, and it covers the description as well as the screenshot. The
recorder's `progress` hook reports a fraction and how long the next stretch should take: from the
press to 90% over the screenshot delay plus an estimated grab, and 100% once the step is written.
Main scales that to 45% when an AI description is coming, eases on to 95% over 3.5 s while the model
writes, and sends 100% when it lands. The card eases a registered `--p` across each stretch, never
backwards within one capture, which pushes the photo out of a slot under the camera and develops the
real screenshot in it from 40%. The step lands once, with the AI title and badge; the Basic title
never flashes first. A description that has not arrived after 8 s lands the step as Basic, and the
AI text still replaces it in place when it comes. Landing fires the flash and grows the photo,
through the Web Animations API, from where it was printed into the preview's own rectangle; the
title and badge fade in once it arrives. Nothing of the previous step shows while this runs, which is what the old veil was for: with a
delay set, the last screenshot showing through read as the new step taken with the old picture.
Reduced motion skips the grow. A title that wraps onto its second line takes that line from the
screenshot rather than from the screen: the preview is 150 px less whatever the title adds beyond
one line, which the card measures after every render, so the card is one height while capturing and
once any step lands, and the order stays the extension's — screenshot, title, badge row. A Remove button on the
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

Where editing returns depends on where it began. From the Ready state it arms as before.
From a recording, Done carries on recording: picking Area on the paused card and pressing Enter
resumes straight away, because drawing the area is the last thing between the person and the next
step. Cancel goes back to the pause after restoring the mode that was active before Area was picked. Picking Area mid-recording used to only save the setting, so the next steps were
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
AI with the title shown throughout, the printer at a reported percentage and waiting for the AI description before the step lands, and the Remove command. On Linux it
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
thing, and nothing about that fails a build. The description queue is shared too, as below. The rest
of the two paths genuinely differs — voice narration and the input finalisation exist only in the
extension, and the application name only on the desktop.

Main cannot `invoke` a renderer, so `ask()` sends a request with a generated reply channel and waits
for `ipcMain.once` on it, with a timeout. The preload's `onRequest` is the other half. A handler that throws
answers with `{ error }`, and `ask()` rejects with that message rather than resolving with it. It used
to resolve, so a guide that failed to be created came back as the guide id `{ error: … }`: the start
dialog's `catch` never ran and the recording went on writing steps to no guide. Guide creation
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
set, so an interrupted delete costs disk until the next launch rather than forever. A known id is a
row's own id or the file its `src` names, because duplicating a guide copies the rows under new ids
while they keep pointing at the original files; counting row ids alone deleted a copy's screenshots
the first time the original was deleted and the app restarted.

A failed screenshot does not cost the step. The extension already worked this way: when the grab or
the crop throws, the step is written with its element and description and no screenshot row, and
the guide shows the image placeholder with its upload button. On the desktop the error used to reach
the capture queue, which logged it and wrote nothing, so the click vanished without a word; the card
now lands the step with an empty preview instead of printing a picture that does not exist.

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

`guideActions` on `AppFrame` is the slot it mounts into, in the top bar beside Edit and Export and
under the same `exportData` guard, so the control appears exactly when the rest of the guide toolbar does. The
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
`Ctrl`, `Alt` or `Meta`, and every such key also appends to a buffer of what was typed. It closes on any of those, on a click, on pause, on stop, or after 1000 ms
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
autocomplete. It is always read — a switch to use only the keystroke buffer was taken out, because it
existed for edge cases nobody would set on purpose. The
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

Finish opens the guide at once, the way the extension's Stop opens its dashboard, and the naming
runs behind it: main sends `mimik:capture:finishGuide` without awaiting it and shows the window on the
guide straight away, where it used to wait up to 45 s for descriptions and a title before showing
anything. A recording with no steps opens its empty guide too, rather than dropping back to the
library with the guide unseen. The guide view shows the extension's own placeholders meanwhile —
"Untitled guide" over a shimmering "Writing a description…", and "Writing step description…" on each
step still waiting — and fills in as each write lands.

That only works because the desktop hears its own writes. Guide changes travel on the
`mimik-guides` BroadcastChannel, which never delivers a message to the context that sent it; the
extension writes from its worker and reads in its pages, so the channel was always enough there, but
the desktop writes and reads in one window, and a guide opened before its descriptions were written
never updated, and the library never showed a guide recorded while it was on screen. On the desktop
`notifyGuidesChanged` therefore also dispatches on a same-window `EventTarget` that `onGuidesChanged`
listens to. Every listener only reloads, so a view hearing its own edit costs a re-read and nothing
else.

**Every AI request goes through the main process.** A renderer is an ordinary web origin, so a
`fetch` to `api.anthropic.com` is blocked by CORS and throws — which reads as a rejected key when it
is really a request that never left. The extension never hits this because it validates in the
background service worker, where `host_permissions` exempts it, and that is the thing the desktop had
no equivalent of. `CoreEnv` therefore carries an optional `fetch` and core calls it through
`coreFetch`, so `validateApiKey`, `getAIDescription` and `generateGuideMeta` all route through
whatever the surface supplies. The desktop supplies a wrapper over `mimik:ai:fetch`, which runs
Electron's `net.fetch` in main. It refuses any url that is not `http:` or `https:`, because the
renderer names the url and main is the one holding the network. A text, JSON or event-stream
response comes back as text and anything else as base64, which the renderer decodes into bytes:
voice-over audio went through the same path as JSON and arrived as mangled text. The voice-over
client calls `coreFetch` for that reason rather than the global `fetch`, which a renderer origin
cannot use against a provider. The request's abort signal crosses too: `mainFetch` stops waiting the moment the signal fires and
sends `mimik:ai:abort` with the request's id, and main aborts its `net.fetch`. It used to drop the
signal, so neither the 60-second limit on a voice-over clip nor cancelling the export ever reached the
request, and one stalled clip held the export on "Narrating step 3 of 6" forever.

Ask AI and Generate description reach the model through `messages.send`, which the extension answers
from its background worker. The desktop has no worker, and its adapter's `send` used to throw for
everything, so both failed with "generation failed" before any request was made. It now calls the
same two functions the worker calls — `rewriteSelection` and `generateDescriptionOnDemand`, which
moved into core's `guide-description.ts` with `resolveGuideMetaInputs`, the inputs both surfaces name
a guide from — and still refuses the messages that only mean something in a browser.

A failed key check says which failure it was. `reason: 'network'` is worded "could not reach the
provider", not "rejected" — the two are indistinguishable to a user and only one of them is their
key's fault.

Descriptions and the guide's name are written by the user's own provider key when there is one, and
by rule when there is not. `getAIDescription` takes a serialised context string rather than a
`DOMContext`, because the desktop has no DOM to hand it: `serializeScreenContext` writes the same
shape of thing from the application, the window title, the control's role and name, and the value,
which is what UIAutomation knows. No screenshot is ever sent.

The desktop has its own step prompt, `SCREEN_STEP_DESCRIPTION_PROMPT`, which `getAIDescription` takes
in place of the extension's. The shared one said "a browser workflow… on a web page", and handed a
UIAutomation role it wrote "Click "Downloads (pinned)" in the treeview". The desktop prompt speaks of
a desktop application and tells the model to name a control by its label and never by a technical
type. The context reads the role as words, `tree item` rather than `treeitem`, and carries the step
before this one, read when the queue reaches the step so it is that step's AI text when there is one.

A guide is named from where each step happened as well as what it did: `guideMetaSteps` gives each
step a `place`, its URL in the extension and its application and window on the desktop, which had
sent an empty address and left the model to invent one — a File Explorer guide came back as a
Microsoft Edge one. The naming prompt says either kind of place may appear and names only what the
steps name.

The key, model and endpoint are read once, by `resolveAiCredentials` in core's `keys.ts`, which the
extension's descriptions, guide naming and rewrite and the desktop's all call; there had been four
copies of the same read and default-model fallback. The steps a guide is named from are
`guideMetaSteps` in `meta.ts` — the actions only, the first ten and last five past fifteen — for the
same reason.

A step is written with its heuristic description immediately and, when a provider key is saved,
with `aiPending` set; then it is rewritten when the model answers. Saving a key is what enabling AI
means here, so without one the flag is never set and nothing on the card claims a description is
coming. With one, the flag is cleared **whichever way the request goes** — a miss and a failure both
clear it — because a pending flag that only clears on success is the same trap as a title
placeholder that only resolves with AI.

The rewrite goes through the extension's own queue, `description-queue.ts` in core: one request at a
time, 45 s each at most. The desktop fired every description on its own, with no limit and nothing
waiting for them at Finish, so a hung request left a step on "Writing…" for good and a guide could be
named before its last descriptions landed. Finish now runs the extension's Stop sequence through
`settleDescriptions` — wait up to 20 s for the queue, then clear any flag still set — before the name
is written, with the guide already open on screen while it does.

A failure also says why, in the extension's words. `describeStep` classifies the error with core's
`describeAiFailure` and sends the reason and provider with `mimik:capture:described`; main keeps it
on the overlay view, and the card shows `aiFailureNotice` — the headline and action the side panel's
`AiStatus` shows, such as "OpenAI rejected your API key. Check your key in Settings." — above its
buttons, where the side panel shows it above Finish, until the next recording starts. It used to be
`catch { return null }`, so a rejected key and no network both looked exactly like having no key.
`aiFailureKey` and `aiActionKey` moved from the side panel into `capture/ai/errors.ts` for it.

Naming follows the extension. With no key the fallback — the recorded application, or a generic name
where none was identified — is written at once. With one, the guide stays "Untitled guide" under
the shimmer until the descriptions settle and `generateGuideMeta` answers, and the fallback is written
only if it returns no title, so the guide always ends up named and never shows an application name
that is about to be replaced.

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

The frame around the dashboard is the exception that proves it. `AppFrame` is the extension's own
dashboard frame, in `packages/ui` and mounted by both surfaces, because it is navigation rather than
capture and there was nothing about it worth diverging on. It is a sidebar and a top bar. The sidebar
holds the mascot, Start Capture, All Guides, Starred and Trash with their counts, and Settings at the
foot. On the desktop the Settings row also reads "Version 1.1.1" at its right end, in the grey of the
counts, through AppFrame's `version`, which the extension does not pass. The top bar holds search on the left and the page's own actions on the right — sort and the
list or grid switch on the library, and Zoom, Edit, Version history and Export on a guide. Neither
repeats a title: the highlighted sidebar item says where you are, and a guide's title is the heading
over its steps. A breadcrumb and a heading saying "All Guides" were both tried and both only said the
same thing twice.

The sidebar collapses to icons on its own when Version history is open or the window is under
1100 px, because a 232 px sidebar, the guide column and the history panel do not fit side by side in
a 1280 px window, and the extension's tab loses 400 px whenever the browser's side panel is open.
Collapsing it by hand is remembered in `localStorage`; expanding it by hand holds for the session
even where it would otherwise collapse. `useSidebarCollapse` owns that rule.

`AppFrame` takes only a `Route` and reads the rest from `useFullview`, which `GuideContent` already
fills, so the export data arrives with no desktop wiring at all. What differs is passed in:
`onStartCapture` opens `CaptureSheet` on the desktop and the side panel in the extension, and
`onSettings` opens the settings dialog on the desktop and the options page in the extension, which
is what `settingsExternal` marks with an external-link icon. Start Capture is in the sidebar on every
page, where it used to sit only above the All Guides list. The first shared header brought
`SearchModal`, `ExportPreviewModal`, `VideoStepPlayer` and two search components with it — each
needed exactly two import rewrites, `#imports` to `@mimik/core/env` and `@/core/*` to
`@mimik/core/*`, because nothing in them was ever extension-specific beyond how WXT resolves a
module.

The guide page's top bar also holds Duplicate, and Transcript when the guide has a narration
transcript, which only an extension recording produces. The library's controls hold Import, beside
sort and view, and dropping a `.mimik` file anywhere on the library opens the same dialog, because
the file lives in the store where both reach it. Duplicate is also an item in the card menu, which
the list and grid share.

`SearchModal` listens for Ctrl or ⌘ with K itself. The listener used to live in the extension's
`FullViewApp`, so the desktop mounted the same dialog and the shortcut did nothing there. The search
box shows ⌘K on a Mac and Ctrl K everywhere else.

A page of the library never scrolls. `usePageFit` fits as many columns as the width allows, none
narrower than 300 px and at most six, and as many rows of cards or list rows as fit between the top
of the library and the pager pinned to the bottom of the window, and that is the page size. A fixed
three columns in a capped width left most of a wide window empty, and a fixed nine per page pushed
the taller cards and rows past the bottom of it. The list view is capped at `max-w-6xl`, since a row
that spans a wide window is mostly empty line. Each card is the first step's screenshot at 16:9,
cropped the way the guide shows it — zoomed toward the click on the desktop, around the element in
the extension — then where the guide happened, its title on up to two lines, and its step count and
date, with a star on the picture when it is starred. Where it happened is the most common site among
its steps, with its favicon, or the application the first step names, with a letter tile; the tile
never asks for a favicon, because that request would send the application's name to a favicon
service. `loadCardData` reads both for the page being shown. The list view is the same card laid
flat: a 16:9 thumbnail, the title, one line of description, and where it happened with the step
count and date, with the star and the card's menu always visible. A guide with nothing to show has
the mascot's eyes on navy in place of a picture, and every card keeps the line for where it
happened even when it is empty, so an untitled guide lines up with the rest.

Going back to the library from a guide shows it as it was left. The page, the guide count and the
page fit live in the store or beside the hook rather than in the component, which unmounts while a guide is open,
so the grid paints at once on the same page and refreshes behind it. Thumbnails pass `cache` to
`ScreenshotView`, which keeps the drawn image under the same key it already used to skip redraws —
id, blob size, annotations and target — in a map of the last 48, so a card does not redraw its
screenshot through a canvas every time the library opens. The guide's own screenshots do not cache,
since editing changes them constantly. Dates follow the app language through `formatDate`; Chinese was missing from its map
and read in English.

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

The "+" between two steps opens the same sheet, titled "Capture more steps" and saying which step the
new ones follow. The extension's dialog there picks a browser tab to record in, and on the desktop it
could only ever say that no tab was open, so `GuideContent` takes an `onCaptureMore` and the desktop
answers it with the sheet — the choice a desktop recording needs is the mode. The recording itself is
the extension's: the steps land in a staging guide, which the library hides, and Finish settles its
descriptions, snapshots the guide and merges them in with `mergeGuideInto` at the "+", leaving the
guide's name alone. The card numbers them from where they will land. `check:pipeline` asserts the
merge puts the steps at the "+", removes the staging guide and keeps the title.

Routing is `useRoute` and `navigate` from `@mimik/ui`, not a hand-rolled `hashchange` listener. The desktop had one
matching `#guide/<id>`, which is the same scheme the shared router already parses, so adopting it
cost nothing and bought Starred and Trash the routes the sidebar needs.

## Capture Settings

The settings that only a desktop capture needs live in `capture-settings.json` beside the region,
read by main rather than by core, because none of them mean anything to the extension.

| Setting | Default | Effect |
|---|---|---|
| `captureMode` | `window` | What each screenshot frames: the focused window, the whole screen, or a drawn area |
| `screenshotDelayMs` | 0, capped at 2000 | Extra wait between the click and the grab |
| `keepClicksBeyondArea` | off | Whether clicks beyond the capture area are recorded at all, in `region` mode only |
| `recordKeys` | off | Whether a shortcut or a named key becomes a step; off by default, since a guide is clicks and typing |
| `recordTyping` | on | Whether typing becomes a step |
| `typingDebounceMs` | 1000, clamped to 200–5000 | Quiet time that closes a typing session |
| `zoomLevel` | automatic | How far a step zooms toward the click: `null` derives it, or 1–5 in 0.25 steps |
| `shortcuts` | three accelerators | Global keys for start/stop, pause/resume and capture now |

`normaliseSettings` runs on every read and write, so an out-of-range delay clamps and an unknown
mode falls back rather than reaching the recorder, and a key it no longer knows is dropped. It also reads three
settings under the names an earlier build saved them as, so a file written before the rename keeps
its choices; the next save writes only the current names.

No pointer is drawn into a step. Recordings once stored an arrow at the click point in
`edits.cursor`, behind a "Show the cursor" switch, and every exporter drew it — but the guide view
rebuilt the edits it renders from the annotations and the target alone, so the app itself never
showed it and the switch read as broken. The dashed target already says what was clicked, so the
pointer went rather than being wired through: the setting, the mark and the drawing are gone, and an
`edits.cursor` left on an older step is ignored everywhere, exports included. That is also what the
extension has always done, where the target's colour is the only click mark to set.

The brand colour is not in that file. It is `targetColor` in the renderer's settings storage, set
from the Export Branding section with the extension's own card, because the renderer is where both readers
are: the
capture sink stamps it on each step's dashed target, and `branding.ts` takes it as the accent of
every export. Setting it on the desktop therefore recolours exports too, which is what it does in
the extension. The two surfaces keep separate stores, so neither one's choice reaches the other.

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
rectangle for all three modes including both window fallbacks, and a 400 ms delay measurably slows the
grab. It restores whatever
settings were on disk when it finishes.

## Desktop Settings

Six sections behind one left nav: General, Capturing, AI, Export Branding, Shortcuts and API keys, and
the dialog opens on General, the first, as desktop settings conventionally do. General holds three cards named
for what they hold — Language, Startup and Updates — rather than one card named after the section,
which put "General" in the list and again as the pane's only heading. Startup and Updates go
through `setOpenAtLogin` and `checkForUpdates`, which the tray menu used to offer too; the update check
does nothing in an unpackaged build, where the updater never runs. On a Mac, Start at login's hint says only that Mimik opens at
login: macOS 13 and later offer no way to open an app hidden or to tell a login launch apart, so the
window shows there, where Windows keeps it in the tray. The split is the
same one that decides where a file lives. Capturing and Shortcuts describe things the extension has
no concept of, so they are written in `apps/desktop` against `capture-settings.json`. AI descriptions,
video voice-over, the API keys and Branding are identical on both surfaces, so `AiSettings`,
`VoiceoverSettings`, `ApiKeysSettings` and `BrandingSettings` live in `packages/ui` and both apps mount
them; the desktop's AI section is the first two. `ApiKeysSettings` takes a `validate` function — the
desktop passes core's `validateApiKey` directly, and the extension goes through its background
messaging, which is the only part that differs.

**One key per provider, entered once.** Descriptions, narration and voice-over each used to keep a
key of their own — `aiApiKeys`, `voiceApiKey` and `voiceoverApiKeys` — and borrowed OpenAI's across
features only when both sides happened to be OpenAI, so one person pasted the same key up to three
times. The keys now live in one `apiKeys` map, one entry per provider in `KEY_PROVIDERS`, and every
feature reads the key of the provider it uses through `readApiKeys`. Until that map exists,
`readApiKeys` assembles it from the three old settings, the descriptions key winning where two
features held different OpenAI keys; once it exists, even empty, the old settings are ignored, so a
key cleared in the new section cannot come back from an old one. The API keys section is a field per
provider with its logo, checked when the field loses focus and on opening. The result is a pill inside
the field's right end, `KeyStatusPill` — Checking… with a spinner, Verified in green, Rejected in red —
with the reason under the field when it failed. A key that passed is remembered for the session in
`useKeyCheck`, keyed by provider, key, address and model, so reopening the settings shows Verified
at once rather than asking every provider again; a changed key is a new fingerprint and is checked. The feature cards hold no key field at all: each picks its provider
through `ProviderSelect`, which lists every provider the feature supports with its logo and greys out
the ones without a key — your own server without an address — each with an Add key link to the
keys. The link is a button inside a disabled Radix item, so it takes `pointer-events-auto` back from
the item and closes the select itself; on the desktop it opens the API keys section, in the
extension it scrolls to the card at the top of the page. A provider saved before its key was cleared
stays selected and says "Add one in API keys" under the select. The logos are the monochrome marks from the MIT-licensed lobehub
icon set, copied into `ProviderLogo`, because the set would be a dependency of hundreds of icons for
six paths.

Your own server is not a key, it is an address: the second card of the section holds its base URL,
an optional key and whether it speaks the OpenAI or the Anthropic API, stored as `aiServerUrl`,
`apiKeys.server` and `aiServerProtocol`, and AI descriptions picks it like any provider. The check
for it asks the server's `/models` without a model, so Ollama or LM Studio can be confirmed before
anything is chosen; it used to need a model and a key first, which meant typing a key a local server
never reads. It used to be a switch that replaced the selected provider's base URL, stored in
`aiBaseUrl`. `resolveServer` still reads that, and `useApiKeys` moves it into the new settings the
first time the settings open.

`BrandingSettings` is the extension's Brand colour card and Branding card — the colour of the click
highlight and export accent, the logo, the footer line and the attribution — lifted out of
`SettingsView` as they were, with `useBrandingSettings` holding the four values and saving each change
as it happens, the way `useAiSettings` does. The desktop had neither at first: the logo, footer and
attribution were written off as having no desktop meaning, though every desktop export reads them
through `loadBranding`, and the colour was rebuilt in Capturing under a name of its own, "Marker
colour", so one setting read as two features in two places. A setting both surfaces have is the
extension's card, in the extension's order, under the extension's words.

The default logo those exports fall back to is `public/mimik-mark.png`, the extension's own file. The
desktop renderer takes `public/` as its `publicDir`, so the file sits beside the page in dev and in the
build, and its `assetUrl` resolves a path relative to the page rather than to the disk root — a
leading slash on a `file://` page is `file:///mimik-mark.png`. Neither held before, and the fetch
failing quietly returned no logo, so no desktop export ever had one. `check:pipeline` fetches it.

Every card is `SettingsCard` from `packages/ui`: the border, radius, padding, white face and 28px icon
header, with an optional hint under the title and an optional control beside it. The header is
optional too, for the desktop's key list, whose section name already says what it holds. The extension's AI,
Brand colour, Export Branding, Voice narration and Smart blur cards and the desktop's `Card` all use
it; they had been six hand-copied frames, one of them the desktop's. The desktop `Card` only adds the
divided rows inside. Rows inside a
desktop card are `Row`: label and a one-line hint on the left, the control on the right, divided
from the next row, or the control underneath with `stack` when it is too wide to sit beside the
label. The AI card keeps the stacked 11px labels it needs in 400px of side panel — the two are never
on screen at once, and matching them would mean branching that shared component on `client()`.
Capturing is two cards: Screenshots, and Typing and keys.

Each kind of value has one control, and it shows the value rather than hiding it behind a click. A
choice among a few is `Segmented`, a row of buttons with the chosen one filled, in `packages/ui` since
the API keys section uses it for the server's API, where each button is the provider's logo and names itself in a tooltip on hover; that is the capture mode and the zoom, which offers Automatic, 1×, 1.5×, 2×, 3×, 4× and 5× and adds the stored level as one more
button when an older build saved one in between. An on/off is `Switch`, shared with the extension's
cards from `packages/ui` so the two cannot drift. A duration is `Slider`, a
native range input tinted with `accent-accent` beside a chip reading the value in ms or seconds,
because a number field hid what the default was and drew spinner arrows on Windows. A setting that cannot apply is disabled rather than hidden, so the rows
do not jump: outside clicks without Area mode and the typing pause without typing.
Every change is applied to the page before main answers, or a slider dragged across its range would
lag a round trip behind the pointer.

Settings opens as a dialog over the library, not as a page. It is the shared `Dialog` laid out the
way the export preview lays out its own: a title bar with the close button, the section list down
the left and the section scrolling beside it, 880 px wide and at most 650 px tall. As a page it
replaced the library, and on a wide window its content, which tops out around 620 px, sat in a field
of empty space. The dialog also covers the sidebar, which is why no navigation prop exists: one used
to close the old pane when All Guides, Starred or Trash navigated underneath it.
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

The rest of `SettingsView` stayed put. Voice narration and smart blur have no desktop card yet, and it
reaches into `@/lib/browser-api/`. `MicrophonePicker` moved to `packages/ui/src/voice` with the
onboarding, taking `onRequestAccess`: the extension opens its permission page, because a side panel
cannot show the browser's microphone prompt, and the desktop calls `getUserMedia`, which Electron
grants. It mounts the API keys card at the top,
then `AiSettings`, `BrandingSettings` and `VoiceoverSettings` where its own cards were, and passes the
autosave's `queue` as `onChange`, which is only there to raise the Saved badge — the card has already
written the value. It holds `useApiKeys` itself and hands the state to every card, because the
extension shows them on one page and a key pasted at the top has to clear the note under the
narration provider at once; the desktop's `SettingsPanel` holds it for the same reason across
sections.

The options page, which the dashboard's Settings opens, renders the same view with `layout="sections"`:
the section list on the left and one section at a time, named in the URL hash (`#api-keys`), so "Add
one in API keys" switches to that section rather than scrolling. It holds the settings and nothing else: the
privacy note, the bug link and the star card stay in the side panel, which keeps the single column.
The options page used to centre its card vertically in a box the height of the window, and
once the settings outgrew the window the header and the API keys card sat above it, out of reach.

The key rows line up the same way on every surface: the field runs to the card's edge with its status
inside it, and your own server's labels share the width of the name column, so its fields start where
the key fields do. Every field is Poppins, the server's address included, which used to be monospace.

A feature whose chosen provider has lost its key keeps the choice and says so: the select shows a red
No key pill at its right end, in the Verified pill's place and shape, and the list ticks only
providers that can be used, since a tick beside "Add key" read as both at once.

Card titles name what the card holds, not the section they sit in, and every card and row hint is a
sentence. The AI section's first card is Step descriptions, with a hint saying what it writes, where
it said "AI descriptions" under a section called AI; the branding card is Logo and footer, where it
repeated the section's name, Export branding.

The shortcut recorder reads a keystroke and writes an Electron accelerator. It refuses a bare key,
because a global accelerator with no modifier takes that key from every application on the machine,
and it ignores a modifier pressed alone, because `Shift` is not a shortcut. `accelerator()` is a
pure function over the event so it is tested without a keyboard.

## First Run

Both surfaces run one onboarding, `OnboardingFlow` in `packages/ui/src/onboarding`: Welcome, the
steps the surface passes in, then Done. The extension passes AI setup, narration, smart blur, pin and
star, and drops narration on Firefox; the desktop passes AI setup, narration and star, since smart
blur works only on web pages and an installed app is already in the Start menu and on the taskbar,
which is what pinning buys the extension. The steps are the extension's own, moved rather than
copied, so the two cannot drift. What differs arrives as props — `validate` for the key check,
`requestMicrophoneAccess`, and `onFinish`, which opens the side panel and the dashboard in the
extension and shows the library on the desktop — and three strings that name the browser, the
welcome, the narration hint and the Done line, have desktop versions chosen through `client()`, as
is dropping Smart blur from Done's features.

The AI and narration steps ask for a key the way Settings does, not with a field of their own: each
picks its provider through `ProviderSelect`, with every provider enabled since this is where keys get
added, and under it sits that provider's `ProviderKeyRow` from the API keys section, or
`ServerSettings` for your own server. A key typed in the first step is already filled and ticked in
the second when both use the same provider. The step opens with what the feature does rather than a
list of keys, because most people arrive without one, and a form asking for credentials before saying
what they buy is a screen they can only skip.

Done writes `onboardingCompleted`, and the desktop `App` shows the flow until it is set, reading it
through core's `localStorage` like every other setting. The narration step saves the provider and
microphone the desktop's narration will read; the recording card has no microphone button yet.

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
recording begins when it ends. The overlay opens a click-through, content-protected window over the drawn
area in Area mode and over the whole display under the pointer otherwise — Window mode included,
because the window in front when Start is pressed is usually Mimik's own or one about to be left, and
an animation boxed into it read as the recording being limited to it — and that window calls core's
`showStartNotification`, so both surfaces run one
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

## macOS Permissions

A Mac records nothing without two permissions: Accessibility, which the click and key hook and the
accessibility lookup ride on, and Screen Recording, without which every grab comes back as the
wallpaper. Neither can be granted from inside the app, so every way a capture starts — the sheet's
Start, the "+" between steps and the start shortcut — goes through
`whenPermitted` in main, which reads both through `readPermissions` and, when one is missing, holds
the start as `pendingStart`, shows the window and opens `PermissionsDialog` instead. Nothing is
checked at launch, because a person who never records should never be asked. Everywhere but macOS
`readPermissions` answers yes to both and the dialog never opens.

The dialog is the two cards under the mascot, which holds a clipboard with a box for each; a box ticks as its permission is granted, and the mascot smiles once both are. Nothing else is in it. The first Grant permission for each asks macOS,
which shows its own prompt and is what puts Mimik in the list at all —
`isTrustedAccessibilityClient(true)` for Accessibility, a one-pixel `desktopCapturer.getSources` for
Screen Recording — and the prompt's Open System Settings takes the person on. Only that: opening the
pane as well stacked two windows over the dialog. macOS shows each prompt once, so every later click
opens that pane of System Settings instead, which is how a permission denied once can still be
granted; `permission-prompts.json` in userData remembers which prompts have been shown. `useCapturePermissions` re-reads both every two
seconds while it is open, and once both are on the dialog closes and the held start runs. macOS
applies Screen Recording to a running app only after it relaunches, so when the window regains
focus after that button with the permission still off, the card offers Restart Mimik instead:
`app.relaunch` with `--open-capture`, which leaves a pending start that opens the capture sheet, so
the person lands where they were. Closing the dialog drops the held start.

Screen Recording is not the last prompt. macOS Sequoia asks again, in its own words — Mimik "is
requesting to bypass the system private window picker" — the first time an app grabs the screen
without the system's share picker, and again about monthly, which no app can switch off; a screenshot
per click cannot go through a picker. It used to land on the first step, mid-recording, so the first
capture start of each launch on a Mac takes one throwaway grab of the display under the cursor
(`warmScreenCapture`) and the prompt shows while the card says Ready instead.

## Desktop Input Hook and CI

On macOS clicks and keys do not come from `uiohook-napi` at all but from the addon's own event tap,
`machook.rs`: `CGEventTapCreate` on a thread of its own with its own run loop, delivering to
JavaScript through a threadsafe function, keycodes translated back into libuiohook's codes by
`hook_keycode` so the recorder reads one vocabulary on every platform. uiohook-napi's `hook_enable`
waits on a condition variable with no predicate, and when that wait returns early it takes the lock
that marks the hook as running, concludes the start failed and joins the hook thread — which is
itself waiting for that lock to report the hook enabled. Both threads then wait forever, the app
hangs with the card on "Starting…", and on macOS it happened on every start. The tap is
started once and kept, `InputHook.stop()` only drops the listener, and a tap macOS refuses — no
Accessibility — rejects at once instead of hanging. The tap is active rather than listen-only,
because a listen-only tap needs Input Monitoring on top of the Accessibility the dialog asks for, and
it re-enables itself when macOS disables it for a slow callback.

`uiohook-napi` needs no compiler on Windows: the package ships `prebuilds/win32-x64/uiohook-napi.node`,
an N-API build that loads in any Electron, and pnpm never runs its `node-gyp-build` install script
because the package is not in `onlyBuiltDependencies`.

`.github/workflows/desktop.yml` runs on the `desktop` branch, which the extension's `pr-test.yml`
does not cover: lint, typecheck, the tests, the extension build and the storage, pipeline and
overlay checks under `xvfb-run` on Linux, then on Windows the addon, the storage and pipeline checks
and an unsigned NSIS installer uploaded as the run's artifact. `npmRebuild` is off in
`electron-builder.yml`: every native module the app loads is a prebuilt N-API binary, and the rebuild
tried to compile `get-windows` with node-gyp, which needs Visual Studio the runner does not have. On
the Ubuntu runner the job lifts AppArmor's limit on unprivileged user namespaces first, or Electron
falls back to a SUID sandbox helper that is not set up and aborts.

`.github/workflows/desktop-macos.yml` builds the Mac app on GitHub's Apple silicon and Intel
runners: the addon, the storage and pipeline checks, and an unsigned `.dmg` per architecture as the
run's artifacts. It runs only when started by hand from the Actions tab, because a macOS minute
counts as ten against the organisation's included minutes and two runners on every push would
spend them in a few days. The `.dmg` is named with its architecture, since both builds share a
version. The Info.plist carries `NSMicrophoneUsageDescription`, because macOS ends an app that asks
for the microphone without one, and the narration step asks; Accessibility and Screen Recording
need no usage string.

## Export Formats

| Format | Generator | Details |
|--------|-----------|---------|
| HTML | `core/export/html-export.ts` | Self-contained: base64 images, inline CSS, and its own Poppins |
| PDF | `core/export/pdf-export.ts` | jsPDF, A4 portrait, auto page breaks |
| Markdown | `core/export/markdown-export.ts` | Standard MD with base64 image data URLs |
| DOCX | `core/export/docx-export.ts` | Lazy-imported, Word-compatible |
| Mimik bundle | `core/transfer/bundle.ts` | `.mimik` zip: manifest + flattened screenshots + README.md. Re-importable; the others are one-way |
| Video | `core/export/video-export.ts` | WebCodecs via mediabunny (lazy), mp4/H.264 with WebM/VP9 fallback, optional voice-over |
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

### Video voice-over (`core/export/voiceover/`)

Off by default. With a key in settings and the export toggle on, every step description — plus the
guide title over the cover card — is spoken and muxed in as one mono track (AAC for mp4, Opus for
WebM).

`providers.ts` is the registry, shaped like `AI_PROVIDERS`: OpenAI (`/audio/speech`, fixed voice
list) and ElevenLabs (`/text-to-speech/{voice}`, per-account catalog via `listVoices`). Both return
mp3. OpenAI is the default because most users already hold that key, and `resolveVoiceoverConfig`
reads whichever key the API keys section holds for the chosen provider — the same one descriptions
and narration use. A key typed for your own server under the old settings, where it sat in the OpenAI
slot beside a custom `aiBaseUrl`, is moved to the server when `readApiKeys` builds the map, so it is
never sent to `api.openai.com`. **Holding a key never turns narration on**; `exportOptions.voiceover`
defaults to false and only the user flips it, for the current panel session only. It is never
persisted: `saveExportOptions` stores it as false and `loadExportOptions` returns it as false, so no
caller can inherit a paid option from storage, and the export panel, which stays mounted between
opens, turns it off again on close. Switching provider loses nothing, since each provider keeps its own
key, and a voice id is validated against the provider that issued it — an ElevenLabs id selected
under OpenAI falls back to OpenAI's default rather than being sent and rejected. ElevenLabs ids are
taken on trust, since the account catalog is larger than the shipped list.

The clips are synthesised *before the first frame is drawn*, because their lengths decide the
timeline: a step whose narration outruns the 5.23s animation holds its final, zoomed-in frame until
the voice finishes (`voiceTimeline` in `video-support.ts`; `VOICE_LEAD_SEC` in, `VOICE_TAIL_SEC`
out). `composeGuideFrames` therefore works from per-step spans (`stepSpans`/`stepStarts`) rather than
a fixed stride, and `videoChapters` is handed the same timeline so the chapter marks still line up.
With no timeline the spans collapse back to the uniform layout, which is what GIF still uses — GIF has
no audio and is never narrated.

Every animation helper saturates at the end of its window, so the extra frames are a still hold and
need no special case. `voiceTrackPieces` measures each gap from an absolute sample position, so the
rounding cannot drift over a long guide, and a clip that overruns its slot pushes the rest later
instead of being cut.

The container is settled by narration, not before it. `availableContainers` returns *every*
container this browser can encode video into, in preference order, and `prepareVoiceover` walks that
list with `pickVoiceContainer` to find the first whose audio codec also encodes. Video support alone
is not enough: Chromium on Linux encodes H.264 but not AAC, so picking mp4 on video support would
land the export in a container it cannot write the voice track into although WebM/Opus was sitting
right there. A silent export still takes `containers[0]`, since nothing there depends on audio.

Narration never fails an export. No key, no AAC/Opus encoder, nothing to say, or the API itself
refusing — all fall back to a silent video on the structural timeline, so the stretched timeline only
ever exists when a track was actually produced. Every one of those four reports itself on
`VideoExportResult.voiceoverError` as a `VoiceoverSkip` — a `reason` the panel turns into a message,
plus the thrown `detail` for `failed` — because a skip that returns `{voice: null}` with no error
leaves the panel rendering a narrated length for a video with no audio in it, which is a lie. They
log at `error` level rather than `warn` for the same reason: `logger.warn` is compiled out of a built
extension, so a `warn`-only skip is invisible in the one build where a user could hit it. A user
abort is the one thing `narrateOrSkip` rethrows — cancelling an export must still cancel it.

Only the dashboard's export panel can turn narration on. `ExportMenu` in the side panel passes
`voiceover: false` explicitly rather than inheriting the saved option, because that surface has no
toggle and no indicator: a stored preference must not spend money somewhere the user cannot see or
stop it. (That component is currently unmounted — nothing in `src/` imports it — so the guard is
there for whenever it comes back, not for a live surface.) A rejected key's response body is never repeated into the error, since OpenAI echoes part of
the key back in its 401. Clips are cached in Dexie (`voiceClips`, keyed by provider
+ voice + model + text hash, 500 most recent; the row type lives in `core/guides/types.ts` with the
rest of the schema) because the preview re-encodes on every option change
and each miss is a paid API call. The key is read in the export page, not the background: synthesis
is cancellable through the same AbortSignal the encoder uses. `listVoices` does go through the
background, next to `validateApiKey`.

`VideoStepPlayer` was written for a silent video: `autoPlay` plus a hard-coded `muted`, and a control
bar with no volume affordance. Narrated previews flip both — a browser will not autoplay with sound,
so a narrated preview waits for the play button and that gesture buys it audio from the first frame,
while a silent one still autoplays muted as before. The mute toggle is there in both cases.

The player is a plain `<video>`, with its state in `useVideoElement`; the extension dropped the `vidstack` player library, so the shared player no longer uses it. It sits on the app's light background rather than a dark one, in two white cards: the video
with its controls under it, and the step list beside it. Only the frame itself stays dark
(`FRAME_FILL`), sized by container query units to the largest 16:9 that fits the card. The timeline
under the video is one segment per step, sized by the step's length and filled as it plays, and each
segment jumps to its step. The list numbers the steps the way the guide does and marks each one with
`StepKindBadge` — Click, Type, Key, Page or Note, in the style of the AI and Basic badges. It used to
be a coloured dot per kind, and the click dot was the accent, which became the panel's own navy when
the palette changed, so clicks showed no dot at all and read as a different kind from typing.

While the video is made, `VideoLoader` shows the stage it is in. Narrating, the mascot talks, with
its mouth and sound waves moving, over the line being read — `renderVoiceover` reports the next
segment's text with its progress for this. Encoding, the camera mascot films over a running strip of
frames, over the step count. Both stages share one bar with the percentage beside it, and it is the
export's single overall figure, so it carries on from narrating into encoding rather than starting
again: a segmented bar for narration and a percentage for encoding read as two different loaders.
The stage is `useVideoPreview`'s `stage`, not inferred from narration progress: with voice-over on
it starts on `voice` and turns to `video` only on the first encoded frame, because the containers
are probed and the clip cache read before the first clip is asked for, and a loader that took "no
narration yet" for encoding showed the camera first. Until that first clip it reads "Preparing the
voice-over". `LoaderMascot` carries the change as one drawing rather than swapping two: the mouth
stops, the waves fade, the camera drops onto the cap and the film strip slides into a space kept
for it, so nothing below it moves. The bar is `role="progressbar"` with that percentage, which is
what the modal's tests read.

The export panel shows the voice-over control under Video quality wherever video export is possible,
not only on the video preview tab — a guide can be exported to video from the format list without
ever opening that tab. The length estimate appears only once voice-over is on; the estimate's second figure comes from the rendered chapters, so it is the
real narrated length rather than a guess. `videoSeconds` in `video-support.ts` gives the first.

Deliberately out of scope: rephrasing step text for speech (the descriptions are narrated verbatim —
a spoken rewrite was considered and dropped), local/WASM TTS (86-330MB of ONNX weights, `wasm-unsafe-eval`, and
runtime model fetches have drawn Web Store "remotely hosted code" rejections), and muxing the user's
own recorded narration — the mic PCM reaches `runNarrationPipeline` and is discarded, and persisting
it is a separate bet, not a blocker.

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
| Export | jsPDF, docx, mediabunny (WebCodecs video), gifenc (GIF), ElevenLabs (voice-over), client-side HTML/Markdown |
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
| `--color-accent` | `#1E1B4B` | Icons, links, focus rings, toggles, sliders, selected options — the same navy as the buttons |
| `--color-primary` | `#1E1B4B` | Primary buttons, badges, dark backgrounds |
| `--color-primary-foreground` | `#C7D2FE` | Text on dark backgrounds |
| `--color-lavender` | `#C7D2FE` | Soft accent |
| `--color-purple` | `#1E1B4B` | Kept as an alias of the accent |
| `--color-mascot` | `#4F46E5` | The indigo half of the mascot's cap and the camera's light, so the logo keeps its colours |
| `--color-deep` | `#1E1B4B` | Deepest navy |
| `--color-violet` | `#38BDF8` | Sky blue accent |
| `--color-success` | `#059669` | Success green |

The interface is navy and lavender only. The bright indigo `#4F46E5` used to be the accent, and next
to the navy buttons it made two colours mean "selected" on one screen — a navy chosen mode beside an
indigo switch and slider. It remains in exactly the places that are drawn over someone else's
pixels, where a dark mark would vanish on a dark application: the default click highlight
(`DEFAULT_TARGET_COLOR`, which Brand colour replaces), the capture area's edge and grips (`--mark` in
`overlay.css`), the annotation editor's selection handles, and the Guide Me ring. The mascot keeps it
through `--color-mascot`, and the annotation palette and the info callout keep it as a colour a
person picks for content. Sliders draw their own track, navy up to the value and lavender after,
because `accent-color` tints only the filled part and left the rest the browser's grey.

Font: Poppins (loaded via `@fontsource/poppins`).

## Key Technical Details

- **Async event queue** in content script (PQueue, concurrency 1) serializes capture work — each action awaits the background round-trip (screenshot + step write, not the AI description) before the next starts
- **Hover ring hidden when work is enqueued** (`CaptureController.enqueue`, instant `display:none`), and `show()` stays suppressed until the queue drains — a second click while the first capture is still in flight can't bring the ring back before the screenshot. `pointerdown` hides it earlier still, on top of `captureAction`'s 3-frame wait
- **Toggles are not held back.** Interception shoots the page before a click lands, but the browser flips a checkbox *before* dispatching its click and flips it back when the click is cancelled, so holding one captured the state the step was leaving. `shouldInterceptClick` lets `isToggle` targets through (native checkbox/radio, `role` checkbox/radio/switch) and the capture runs after the paint wait instead. A label click normally reaches it as its control via `findFocusableAncestor`, and the click the label forwards is deduplicated. `menuitemcheckbox`/`menuitemradio` stay held, and so does any toggle inside `role=menu`/`menubar` (`MENU_SELECTOR`): the menu closes on the click, so a shot taken after it shows neither the menu nor the box. Held, the box is shot one state behind but in its menu, which is the better guide. A listbox is not held, since a multi-select stays open. Capturing after the click exposed a trap in `getCleanText`: it measures text on a copy attached to the page, and a copy of the checked radio joined the page's group and unchecked the real one, so radios could not be selected while recording. It now never attaches an input, which has no innerText anyway
- **Subframe rects are moved into tab coordinates.** `getBoundingClientRect` is relative to the frame, and `captureVisibleTab` shoots the tab, so a capture inside an iframe drew its outline off by the frame's position. A cross-origin parent is unreachable except by `postMessage`, so `locateFrame` asks the parent's content script, which finds the `<iframe>` by `event.source` (open shadow roots included), measures its content box and scale, and adds its own placement before answering. The lookup runs inside the queued task, next to the rect it moves, since the parent can scroll between the event and the screenshot. The parent only answers direct children (`source.parent`, checked before any DOM search) and only while capture is live, plus `FRAME_ANSWER_GRACE_MS` after `stop()`: a child's last typing step is finalized by the same pause broadcast that stops its parent, and a responder left up for the life of the page would let any frame detect Mimik and track its own position in the tab. An answer outside plausible bounds, or none within 250ms, leaves the rect untranslated
- **Input session** aggregates all typing on a field into one step — click creates it, keystrokes update description, finalize takes final screenshot
- **DOM context** sent as text to AI instead of screenshots — 15-30x cheaper per step
- **Hover ring** (`lib/hover-ring.ts`) is a closed-Shadow-DOM host marked `data-mimik-ignore`, shared by recording and the blur picker (purple). Recording reads the user's `targetColor` so the live ring matches the dashed target baked into screenshots. Never drawn on `iframe`/`embed`/`object` — a capture inside a subframe can't hide the top frame's ring
- **Content script injection** pings first, falls back to `chrome.scripting.executeScript()` for tabs without the script
- **`PAUSED` is a real machine state**, not a flag. It carries a `pauseReason` (`'blur' | 'manual'`) and deliberately does not handle `USER_ACTION`, so nothing can advance `stepCount` while the UI says capture is paused. `CaptureSession.syncWithBackground` only starts on `RECORDING`, so a frame that loads mid-pause stays idle instead of silently resuming. Background step writes are gated on `RECORDING` too, for a frame that missed the stop broadcast
- **Pausing also stops the microphone.** `pauseCapture` flushes and stops narration when it was live, and `resumeCapture` restarts it — otherwise speech during the pause is transcribed and attributed to the step captured after the resume. The mic toggle locks while paused, since narration cannot start outside `RECORDING`
- **The restart has to outlive the flush.** Stopping narration leaves the phase on `'transcribing'` for a whole API round-trip, and `canStartNarrationNow` refuses that phase, so a single attempt on resume always failed and the mic never came back while the panel went on showing narration as enabled. `restartNarrationOnceTranscriptionSettles` retries while `isNarrationSettling()` holds, up to `NARRATION_RESTART_ATTEMPTS` waits on `whenNarrationSettled()`, then calls `reportNarrationLost` so the panel stops claiming the mic is on. It stops *immediately* when the phase is anything else: a start that failed on its own 8s timeout leaves the phase `'idle'`, and retrying there would call `startVoiceCapture` a second time, get `already-recording`, and `closeVoiceHost()` a host that had just started. It is deliberately *not* awaited by `resumeCapture` — the panel is waiting on that reply — so its rejection is caught rather than left unhandled
- **`narrationWasLive` lives in the machine context**, not a module variable, because the worker can be evicted while the recording sits paused. Per the note above, a snapshot persisted before the key existed restores it as `undefined`, so it is read as `=== true`. Its *source* cannot be the module-level `phase` either, which an eviction resets to `'idle'`: `pauseCapture` calls `isNarrationLive()`, which asks the host when the phase says nothing, and counts `'transcribing'` as live so a second pause during the first one's flush does not lose the flag
- **`claimTranscription`/`releaseTranscription` are a matched pair** and every path that reports `'transcribing'` uses them, `recoverNarration` included — a claim without `markNarrationPending` made `whenNarrationSettled()` resolve instantly and burned both restart attempts in one tick. They count outstanding transcriptions rather than holding one slot, because a pause followed by a stop claims twice; `releaseTranscription` returns whether it owned the claim, so a failed stop cannot report an error over a terminal `idle`
- **Resume and Stop wait for a pause still in flight** (`whenPauseSettled`). A Resume that landed while the pause was flushing used to restart the mic before the pause stopped it, leaving the recording live with narration gone
- **Pausing waits for the frames to drain.** `broadcastStopCaptureAndFlush` is answered only once each content script's queue is idle, because `CaptureController.stop()` enqueues the input session's finalize. `handleFinalizeInputStep` is therefore gated on "not IDLE" rather than `RECORDING`: it only ever completes a step the user finished before pausing, and `enterBlurMode` awaits the flush before opening the overlay so that screenshot cannot catch it
- **Navigation listeners treat `PAUSED` as live** (`navigation.ts:isLive`). `URL_CHANGED` has to keep flowing or the first step after a resume is stamped with the pre-pause URL, which Guide Me then replays to; injection has to keep running or a tab opened mid-pause is deaf to the resume broadcast
- **Blur mode pauses via that state**, and a top frame booting into `PAUSED`/`'blur'` re-opens the overlay, so a navigation mid-blur still has a Done button. `exitBlurMode` and the panel's Resume both broadcast `DISMISS_BLUR` before resuming, which closes the overlay but keeps the masks the user just picked; only the end of a recording sends `CLEAR_BLUR` to remove them
- **Smart blur cannot reach** iframes, shadow DOM, canvas/image text, `::before`/`::after`, `<select>`/`<option>`, or attribute-only values like `title`/`alt`; it runs in the top frame only, and a matching input blurs as a whole field. SVG `<text>` *is* blurred. These limits are documented in all five READMEs and *partly* pinned by `core/blur/__tests__/scanner.test.ts` — shadow DOM, `select`/`option`, attribute-only values and whole-field input blur have assertions; canvas/image text, `::before`/`::after` and top-frame-only do not (the last lives in `content.ts`, not the scanner). Move the READMEs with any scanner change
- **Paused-ness is read from the state value, never from `pauseReason`.** A snapshot persisted before `PAUSED` existed has no `pauseReason` key, so it restores as `undefined` — and `undefined !== null` read as paused, which left the panel offering Resume while the machine was still `RECORDING`. `getStateUpdate` normalises the reason to `null`; the reason only picks the wording. The same applies to any context key added later: a restored snapshot will not have it
- **`BlurManager.start()` re-checks `active` after awaiting the presets.** A stop landing inside that await tore down a panel that did not exist yet, and the pending `start()` then mounted it with `active` already `false`, so nothing could ever close it. Any new `await` before the panel mounts needs the same guard
- **xstate snapshot** persisted to sessionStorage so the state machine survives service worker restarts
- **Recording notification** uses `animationend` event (not hardcoded delays) for timing
- **Font loading** uses `@fontsource/poppins` (CSP-safe, no CDN dependency) everywhere, the HTML export included: `export/poppins.ts` inlines the same package's latin and latin-ext woff2 files for 400, 600 and 700 through Vite's `?inline` into `@font-face` rules, about 56 KB. The export used to link Google Fonts, which failed in the desktop's Document preview under its `default-src 'self'` policy and sent every reader's address to Google when the file was opened; the desktop policy now allows `font-src 'self' data:` for the embedded faces. The PDF is still drawn in Helvetica, since jsPDF takes TTF and the package ships only web formats
- **Cross-context sync** via BroadcastChannel — star/delete events update other views without full reload
- **A blur redaction blurs past its own box and clips back to it** (`drawBlurRedaction` in `core/screenshot/draw.ts`). Blurring only the box's pixels averages transparency in at the edges, so the sharp original showed through a ~12px band on every side, and a box drawn snugly around one line of text stayed readable. It blurs `BLUR_MARGIN` pixels beyond the box, and lays a coarse copy of the box underneath first, so where the image itself ends and the blur still thins, what shows is that copy and not the text. The coarse copy is built from the part of the box inside the image, so a box that crosses the edge of a crop is covered too
- **Bundle URLs are scrubbed part by part** (`scrubUrl`): with typed text stripped, each path segment, query value and fragment is decoded, compared against the typed values (a short value only as a whole part) and re-encoded, and the scheme and host are never touched, so typing a word that also appears in the domain cannot corrupt the URL. Outside full mode a `data:` URL keeps only `data:`, and a `file:` URL in origin mode only `file://`
- **Bundle export flattens before it ships** — `redact` annotations are drawn at render time, so `screenshot.blob` still holds the unblurred capture. `flattenScreenshot` burns redactions into the pixels and drops the annotation, and bakes an *explicit* crop (rebasing annotations and resolving `bounds` into an explicit target). The automatic zoom-to-target crop stays as data. Anything that ships a screenshot outside the browser must go through the renderer
- **Guide titles are single-line**, normalised by `sanitizeGuideTitle` on every write path: `updateGuideTitle`, `importGuide`, `revertToSnapshot`, `duplicateGuide` and the AI meta path. Each renderer downstream already assumed it. The HTML and PDF covers clamp to `MAX_TITLE_LINES`, their running headers to one line, the video cover card wraps to two, the sidepanel truncates, and Markdown writes `# <title>`, where a newline ends the heading and spills the rest into the body. A sixth write path needs the same call. `MAX_TITLE_LENGTH` bounds the AI-generated title only (`core/capture/ai/meta.ts`); a typed title is deliberately uncapped, since every renderer above already clamps and a silent stop at 70 characters gave the user no reason for it
- **Imports re-mint every id** — `importGuide` mints new guide/step/screenshot ids in one Dexie transaction. Reusing the ids in the file would let a shared guide overwrite one the recipient recorded. It also clears `aiPending`, which no background job will ever resolve for an imported step
