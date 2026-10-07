# The desktop app

Electron. Main (`src/main`) owns the input hook, the screenshots, the overlay windows and the
network. The renderer (`src/renderer`) owns IndexedDB and writes guides through `@mimik/core`
exactly as the extension does. The preload exposes `window.mimik` with context isolation on.

## Main-process rules

- The recording lifecycle is core's capture machine (`IDLE`, `ARMED`, `RECORDING`, `PAUSED`), run by
  one actor in main. The overlay sends it events and renders its windows from its state. Never keep
  a second copy of "is it recording" anywhere. Redrawing the area mid-recording is `PAUSED` with
  reason `area`.
- Main bundles `@mimik/core` (it is excluded from `externalizeDepsPlugin`), so value imports from
  core work there. Every other dependency stays external.
- A packed app has its Electron fuses flipped (`scripts/flip-fuses.cjs`): no run-as-node, no
  `NODE_OPTIONS` and no `--inspect`. Pack with `MIMIK_INSPECTABLE=1` to keep the inspector.
- `out/main` stays flat (`chunkFileNames` is pinned), because main resolves `../renderer` and
  `../preload` from `__dirname`.
- Every AI and provider request goes through main (`mimik:ai:fetch`). A renderer `fetch` to a
  provider fails on CORS and looks like a rejected key.
- Screenshot bytes never cross IPC. Main writes a PNG under `userData/screenshots` and sends an id
  and a `mimik-screenshot://` URL.
- `ask()` from main to the renderer rejects when the handler throws. Never resolve with the error.
- Never unregister a global shortcut from inside its own handler, or Windows hangs. Rebinds are
  deferred with `setImmediate`.

## Capture

- A click is the press, not the release. The element lookup and the display grab both start in the
  `mousedown` handler, and the frame is chosen after the grab.
- A click frames the window under the pointer (`windowAt`). A typing step frames the window its
  field is in. A key step reads the focused window.
- Typing is an `InputSession`, finalized like the extension's. Its text is read from the focused field,
  and `typedTextFor` falls back to the keystroke buffer when the field has no value, spans lines or
  holds more than 200 characters.
- A failed screenshot still writes the step, without a picture. A failed lookup is `null`, never an
  error.
- A desktop step is an ordinary `Guide` / `Step` / `Screenshot`. There is no desktop step type, and
  consumers never branch on `elementMeta.source` (Guide Me's `isReplayable` is the one exception).

## Overlays

- `setContentProtection(true)` is applied after a window is shown, never at creation. On Linux,
  where it does nothing, `overlay.withHidden` hides the overlays around each grab.
- The card, boundary and area editor share one HTML file. Scope card rules under `body.controls`.
  `check:overlay` asserts the hint stays static.
- Anything hidden on the card uses `hidden`, which `body.controls [hidden]` forces to
  `display: none`.
- Icons come from `lucide` (vanilla) and the mascot from `mascot-shapes`. Never copy path data.

## macOS

- Accessibility and Screen Recording are checked through `whenPermitted` before every start. Never
  check them at launch.
- The microphone status comes from `systemPreferences`, because Electron grants the page's own
  permission silently.
- On a Mac, shortcuts are written with `⌃⌥⇧⌘` and no separator, through `shortcutLabel`.

## Checks

`check:storage`, `check:pipeline`, `check:overlay` and `check:capture` build the app and drive
real windows. Run them under `xvfb-run` on Linux. `check:pipeline` covers capture, cropping, every
exporter and the `.mimik` round trip. CI runs them on Linux and Windows (`desktop.yml`) and on
demand on macOS (`desktop-macos.yml`).
