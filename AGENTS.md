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
│   │   ├── voice/            # Narration: energy gate, batching, transcribe, attribute, transcript
│   │   ├── machine.ts        # xstate capture state machine
│   │   ├── session.ts        # CaptureSession (lifecycle manager)
│   │   ├── spa-nav.ts        # SPA navigation tracking
│   │   ├── start-notification.ts # Recording notification overlay
│   │   └── step-description.ts   # Fallback rule-based descriptions
│   ├── blur/                # Smart blur: regex presets, DOM scanner, element picker, panel UI
│   ├── export/              # HTML, PDF, DOCX, Markdown, video/GIF generators + shared utils
│   │   └── voiceover/       # OpenAI/ElevenLabs text-to-speech for narrated video exports
│   ├── transfer/            # .mimik bundle: export/import a guide between browsers
│   │   ├── schema.ts            # BundleManifest + validation of untrusted files
│   │   ├── flatten.ts           # flattenScreenshot (bakes redactions before a guide leaves)
│   │   ├── scrub.ts             # scrubValues (removes typed values from prose)
│   │   ├── bundle.ts            # exportGuideAsBundle (zip via fflate)
│   │   └── parse.ts             # readBundle (unzip + validate)
│   └── guides/              # Data layer: types, Dexie DB, CRUD service, title rules, transcript timeline
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
1. User clicks "Start capture" in sidepanel
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

The dashboard's transcript panel is the answer to the other half. It shares the side-panel column
with version history, so the store keeps them mutually exclusive, and the TopNav button only appears
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
source alone would have left verbatim speech behind. A description the user or the AI wrote is
otherwise left alone. `mergeGuideInto` re-keys transcripts onto the
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

## Export Formats

| Format | Generator | Details |
|--------|-----------|---------|
| HTML | `core/export/html-export.ts` | Self-contained, base64 images, inline CSS |
| PDF | `core/export/pdf-export.ts` | jsPDF, A4 portrait, auto page breaks |
| Markdown | `core/export/markdown-export.ts` | Standard MD with base64 image data URLs |
| DOCX | `core/export/docx-export.ts` | Lazy-imported, Word-compatible |
| Mimik bundle | `core/transfer/bundle.ts` | `.mimik` zip: manifest + flattened screenshots + README.md. Re-importable; the others are one-way |
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
borrows it from AI descriptions on the same terms `resolveVoiceApiKey` uses — both sides OpenAI, or
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
- **The restart has to outlive the flush.** Stopping narration leaves the phase on `'transcribing'` for a whole API round-trip, and `canStartNarrationNow` refuses that phase, so a single attempt on resume always failed and the mic never came back while the panel went on showing narration as enabled. `restartNarrationOnceTranscriptionSettles` retries while `isNarrationSettling()` holds, up to `NARRATION_RESTART_ATTEMPTS` waits on `whenNarrationSettled()`, then calls `reportNarrationLost` so the panel stops claiming the mic is on. It stops *immediately* when the phase is anything else: a start that failed on its own 8s timeout leaves the phase `'idle'`, and retrying there would call `startVoiceCapture` a second time, get `already-recording`, and `closeVoiceHost()` a host that had just started. It is deliberately *not* awaited by `resumeCapture` — the panel is waiting on that reply — so its rejection is caught rather than left unhandled
- **`narrationWasLive` lives in the machine context**, not a module variable, because the worker can be evicted while the recording sits paused. Per the note above, a snapshot persisted before the key existed restores it as `undefined`, so it is read as `=== true`. Its *source* cannot be the module-level `phase` either, which an eviction resets to `'idle'`: `pauseCapture` calls `isNarrationLive()`, which asks the host when the phase says nothing, and counts `'transcribing'` as live so a second pause during the first one's flush does not lose the flag
- **`claimTranscription`/`releaseTranscription` are a matched pair** and every path that reports `'transcribing'` uses them, `recoverNarration` included — a claim without `markNarrationPending` made `whenNarrationSettled()` resolve instantly and burned both restart attempts in one tick. They count outstanding transcriptions rather than holding one slot, because a pause followed by a stop claims twice; `releaseTranscription` returns whether it owned the claim, so a failed stop cannot report an error over a terminal `idle`
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
- **Bundle export flattens before it ships** — `redact` annotations are drawn at render time, so `screenshot.blob` still holds the unblurred capture. `flattenScreenshot` burns redactions into the pixels and drops the annotation, and bakes an *explicit* crop (rebasing annotations and resolving `bounds` into an explicit target). The automatic zoom-to-target crop stays as data. Anything that ships a screenshot outside the browser must go through the renderer
- **Guide titles are single-line**, normalised by `sanitizeGuideTitle` on every write path: `updateGuideTitle`, `importGuide`, `revertToSnapshot` and the AI meta path. Each renderer downstream already assumed it. The HTML and PDF covers clamp to `MAX_TITLE_LINES`, their running headers to one line, the video cover card wraps to two, the sidepanel truncates, and Markdown writes `# <title>`, where a newline ends the heading and spills the rest into the body. A fifth write path needs the same call. `MAX_TITLE_LENGTH` bounds the AI-generated title only (`core/capture/ai/meta.ts`); a typed title is deliberately uncapped, since every renderer above already clamps and a silent stop at 70 characters gave the user no reason for it
- **Imports re-mint every id** — `importGuide` mints new guide/step/screenshot ids in one Dexie transaction. Reusing the ids in the file would let a shared guide overwrite one the recipient recorded. It also clears `aiPending`, which no background job will ever resolve for an imported step
