# @mimik/core

Logic both surfaces share. It reaches the surface through `configureCore` (storage, i18n, `fetch`,
`client`), and each app imports its own `core-env.ts` for that side effect.

## Storage

- Dexie, database `mimik`. A schema change is a new `version(n)` with an upgrade, never an edit to
  an old one. `check:storage` upgrades a real v1 store.
- A screenshot row holds either a `blob` (extension) or a `src` (desktop). The service hydrates one
  into the other on read, so nothing above the storage layer sees the difference.
- `importGuide` mints new ids for everything and clears `aiPending`.
- Guide titles are single-line. Every write path calls `sanitizeGuideTitle`, and a new write path
  must too.

## Narration and transcripts (`capture/voice`, `guides/transcript.ts`)

- Every transcribed segment is kept as a `TranscriptLine`, attributed or not, and written before
  anything is applied to steps.
- `Step.narratedDescription` is cleared only by `deleteTranscripts`.
- Transcripts never reach an export or a `.mimik` file. Deleting them also strips the spoken text
  out of steps and snapshots, and recomputes each snapshot's `contentHash`.
- `VOICE_RESULT` carries `final`. Never infer finality from other state.

## Descriptions and AI

- `buildFallbackDescription` names a step without AI. Its precedence (label, placeholder, text,
  alt, name, role) is shared by every element source, so never branch on `source`.
- `aiPending` is cleared whichever way the request ends.
- Credentials are read through `readAiCredentials`, and whether AI is used for steps or guide titles
  through `readAiUse`. Requests go through `coreFetch`.
- A rejected key's response body is never repeated in an error, since providers echo the key back.

## Export

- Export paths that ship a screenshot go through the renderer (`flattenScreenshot` for bundles), so
  redactions are burned in.
- `video-support.ts` stays free of mediabunny imports, because both export UIs load it eagerly.
- Voice-over is never persisted as on, and a failure falls back to a silent video with a
  `voiceoverError`.

## Tests

`blur/__tests__/blur-baseline.test.ts` and `capture/__tests__/naming-baseline.test.ts` compare
against recorded JSON under `__snapshots__`. A diff there means behaviour changed.
