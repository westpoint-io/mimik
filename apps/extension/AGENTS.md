# The extension

A WXT Manifest V3 extension. Under `src/`: `entrypoints/` (background, content, sidepanel, fullview,
onboarding, options, offscreen, mic-permission), `capture/`, `blur/`, `guideme/`, `lib/` and `ui/`.

## Flow

The content script captures events and sends them to the background service worker, which takes
the screenshot, writes the step to IndexedDB and broadcasts state to the side panel over a port.
Guide changes cross contexts on the `mimik-guides` BroadcastChannel. The messages are in
`lib/messaging.ts`, the tab messages in `lib/tab-messages.ts`, and the frame-placement messages in
`core/capture/dom/frame-placement.ts`.

## Capture lifecycle (xstate in the background)

- `PAUSED` is a real state with a `pauseReason` (`'blur' | 'manual' | 'area'`, where `area` is
  desktop only). It never handles `USER_ACTION`. Step writes are gated on `RECORDING`, except
  `finalizeInputStep`, which is gated on "not IDLE".
- Read paused-ness from the state value, never from `pauseReason`. A snapshot restored from
  `sessionStorage` may predate any context key, so treat new keys as possibly `undefined` (compare
  with `=== true`).
- The worker is evicted after about 30 s idle. Anything that must survive goes in the machine
  context or Dexie, never in module state.
- Pausing stops narration and resuming restarts it. The restart retries while transcription
  settles, and it is never awaited by `resumeCapture`. `claimTranscription` and
  `releaseTranscription` are always used as a pair.
- Resume and Stop wait for a pause still in flight (`whenPauseSettled`).

## Capturing a click

- Work goes through one PQueue (concurrency 1). The hover ring hides on enqueue and returns only
  when the queue drains.
- An ordinary click is cancelled, screenshotted, then replayed (`click-intercept.ts`). Toggles are
  not held back unless they sit inside a menu.
- Subframe rects are translated into tab coordinates by asking the parent frame. The parent answers
  only direct children, and only while capture is live.
- A typing session is one step: the click creates it, keystrokes update it, and Enter, Escape or
  blur finalize it.

## Things that break quietly

- Every overlay drawn into a page is built by `createOverlayRoot`: a closed shadow root carrying
  `data-mimik-ignore`. Without the attribute, Mimik records and blurs its own UI.
- `BlurManager.start()` re-checks `active` after every `await` before mounting the panel.
- A `vi.mock` path must name the file the function lives in, not its folder. A stale path mocks
  nothing and does not fail.
- `logger.warn` is compiled out of builds. Use `error` for anything a user could hit.
- On a fresh Firefox install the background removes the `<all_urls>` grant. Firefox bug 1758306
  records the grant but `captureVisibleTab` still rejects, and removing it makes the next
  user-gesture `permissions.request()` grant it properly. Drop the workaround once Mozilla ships
  the fix.
- Smart Blur cannot reach iframes, shadow DOM, canvas, pseudo-elements, `<select>` or attribute
  values. The five READMEs say so, and they need updating with any change to the scanner.
