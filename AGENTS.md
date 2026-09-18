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
│   ├── export/              # HTML, PDF, DOCX, Markdown, video/GIF generators + shared utils
│   │   └── voiceover/       # ElevenLabs text-to-speech for narrated video exports
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
| Capture lifecycle | xstate | State machine (IDLE ↔ RECORDING ↔ PAUSED) in background service worker |
| Fullview UI | Zustand | Search modal, guide counts, active guide data |
| Persistence | Dexie (IndexedDB) | Guides, steps, screenshots, snapshots, cached voice clips |
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

## Export Formats

| Format | Generator | Details |
|--------|-----------|---------|
| HTML | `core/export/html-export.ts` | Self-contained, base64 images, inline CSS |
| PDF | `core/export/pdf-export.ts` | jsPDF, A4 portrait, auto page breaks |
| Markdown | `core/export/markdown-export.ts` | Standard MD with base64 image data URLs |
| DOCX | `core/export/docx-export.ts` | Lazy-imported, Word-compatible |
| Video | `core/export/video-export.ts` | WebCodecs via mediabunny (lazy), mp4/H.264 with WebM/VP9 fallback, optional voice-over |
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

### Video voice-over (`core/export/voiceover/`)

Off by default. With a key in settings and the export toggle on, every step description — plus the
guide title over the cover card — is spoken and muxed in as one mono track (AAC for mp4, Opus for
WebM).

`providers.ts` is the registry, shaped like `AI_PROVIDERS`: OpenAI (`/audio/speech`, fixed voice
list) and ElevenLabs (`/text-to-speech/{voice}`, per-account catalog via `listVoices`). Both return
mp3. OpenAI is the default because most users already hold that key, and `resolveVoiceoverConfig`
borrows it from AI Descriptions on the same terms `resolveVoiceApiKey` uses — both sides OpenAI, or
nothing. **Holding a key never turns narration on**; `exportOptions.voiceover` defaults to false and
only the user flips it. Keys are stored per provider (`voiceoverApiKeys`) so switching does not lose
one, and a voice id is validated against the provider that issued it — an ElevenLabs id selected
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

Narration never fails an export. No key, no AAC/Opus encoder, nothing to say, or the API itself
refusing — all log and fall back to a silent video on the structural timeline, so the stretched
timeline only ever exists when a track was actually produced. The failure is reported back on
`VideoExportResult.voiceoverError` and the export panel says the video came out silent, because
dropping paid-for narration without telling anyone is worse than the error. A user abort is the one
thing `narrateOrSkip` rethrows — cancelling an export must still cancel it.

Only the dashboard's export panel can turn narration on. `ExportMenu` in the side panel passes
`voiceover: false` explicitly rather than inheriting the saved option, because that surface has no
toggle and no indicator: a stored preference must not spend money somewhere the user cannot see or
stop it. A rejected key's response body is never repeated into the error, since OpenAI echoes part of
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
- **`PAUSED` is a real machine state**, not a flag. It carries a `pauseReason` (`'blur' | 'manual'`) and deliberately does not handle `USER_ACTION`, so nothing can advance `stepCount` while the UI says capture is paused. `CaptureSession.syncWithBackground` only starts on `RECORDING`, so a frame that loads mid-pause stays idle instead of silently resuming. Background step writes are gated on `RECORDING` too, for a frame that missed the stop broadcast
- **Pausing also stops the microphone.** `pauseCapture` flushes and stops narration when it was live, and `resumeCapture` restarts it — otherwise speech during the pause is transcribed and attributed to the step captured after the resume. The mic toggle locks while paused, since narration cannot start outside `RECORDING`
- **Pausing waits for the frames to drain.** `broadcastStopCaptureAndFlush` is answered only once each content script's queue is idle, because `CaptureController.stop()` enqueues the input session's finalize. `handleFinalizeInputStep` is therefore gated on "not IDLE" rather than `RECORDING`: it only ever completes a step the user finished before pausing, and `enterBlurMode` awaits the flush before opening the overlay so that screenshot cannot catch it
- **Navigation listeners treat `PAUSED` as live** (`navigation.ts:isLive`). `URL_CHANGED` has to keep flowing or the first step after a resume is stamped with the pre-pause URL, which Guide Me then replays to; injection has to keep running or a tab opened mid-pause is deaf to the resume broadcast
- **Blur mode pauses via that state**, and a top frame booting into `PAUSED`/`'blur'` re-opens the overlay, so a navigation mid-blur still has a Done button. `exitBlurMode` and the panel's Resume both broadcast `DISMISS_BLUR` before resuming, which closes the overlay but keeps the masks the user just picked; only the end of a recording sends `CLEAR_BLUR` to remove them
- **Smart blur cannot reach** iframes, shadow DOM, canvas/image text, `::before`/`::after`, `<select>`/`<option>`, or attribute-only values like `title`/`alt`; it runs in the top frame only, and a matching input blurs as a whole field. SVG `<text>` *is* blurred. These limits are documented in all five READMEs and *partly* pinned by `core/blur/__tests__/scanner.test.ts` — shadow DOM, `select`/`option`, attribute-only values and whole-field input blur have assertions; canvas/image text, `::before`/`::after` and top-frame-only do not (the last lives in `content.ts`, not the scanner). Move the READMEs with any scanner change
- **Paused-ness is read from the state value, never from `pauseReason`.** A snapshot persisted before `PAUSED` existed has no `pauseReason` key, so it restores as `undefined` — and `undefined !== null` read as paused, which left the panel offering Resume while the machine was still `RECORDING`. `getStateUpdate` normalises the reason to `null`; the reason only picks the wording. The same applies to any context key added later: a restored snapshot will not have it
- **`BlurManager.start()` re-checks `active` after awaiting the presets.** A stop landing inside that await tore down a panel that did not exist yet, and the pending `start()` then mounted it with `active` already `false`, so nothing could ever close it. Any new `await` before the panel mounts needs the same guard
- **xstate snapshot** persisted to sessionStorage so the state machine survives service worker restarts
- **Recording notification** uses `animationend` event (not hardcoded delays) for timing
- **Font loading** uses `@fontsource/poppins` (CSP-safe, no CDN dependency)
- **Cross-context sync** via BroadcastChannel — star/delete events update other views without full reload
