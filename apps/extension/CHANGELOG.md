# Changelog

## [1.4.1](https://github.com/westpoint-io/mimik/compare/v1.4.0...v1.4.1) (2026-10-27)


### Bug Fixes

* **i18n:** fit the russian store description in 132 characters ([#196](https://github.com/westpoint-io/mimik/issues/196)) ([890b6dc](https://github.com/westpoint-io/mimik/commit/890b6dc5a966833562ce24bf7012b4d9dc6b7557))

## [1.4.0](https://github.com/westpoint-io/mimik/compare/v1.3.0...v1.4.0) (2026-10-26)


### Features

* Russian, for the interface and for AI step descriptions
* a redesigned onboarding, and a thank-you letter that opens once for existing users
* choose whether AI writes step descriptions, guide titles, or both
* settings to record keyboard shortcuts and what you type, both off by default
* typing steps name the field you typed in
* discard a recording instead of finishing it
* capture more kinds of steps
* the dashboard moves to a sidebar, with a fuller library page and thumbnails
* search opens near the top with your recent guides
* the options page shows one section at a time, with an About section and a GitHub card
* narration and voice-over are grouped under AI in settings, with a live microphone meter
* API key checks show as pills in the field, and a provider with no key is flagged
* the version shows beside Settings, and the top bar fits narrow windows

### Bug Fixes

* nothing is sent to the AI provider for steps when AI is off for steps
* page overlays are built from elements instead of HTML strings, and the blur picker button is translated
* typing, key and colour settings apply to a recording that is already running
* shortcut steps are named with the held keys, as Ctrl+K
* a click made just before pause or finish is kept
* a new step is numbered from the steps that exist, so a deleted one leaves no gap
* exports get their own brand colour, separate from the click highlight
* Russian dates, AI instructions and prompt examples
* the extension never injects into the Chrome Web Store
* the dashboard's Start capture button starts a new capture
* a narration that heard nothing ends with the calm note, and narration switches off when the microphone is refused
* naming and merging wait for narration to finish
* fflate, the AI SDK and DOMPurify are updated past their security advisories

## [1.3.0](https://github.com/westpoint-io/mimik/compare/v1.2.0...v1.3.0) (2026-09-29)


* Guides can be exported as a `.mimik` file and imported into someone else's Mimik
* Blurred areas are erased from a shared guide's images, and text you typed is stripped from it
* Video exports can be narrated with an OpenAI or ElevenLabs voice
* Narration keeps its full transcript, and a step can get back what you said after you edit it
* The transcript can be deleted on its own, and never leaves your browser
* Guides can be duplicated
* Recording can be paused and resumed
* Speech while recording is paused no longer lands on the next step
* Pages that load during blur mode no longer start capturing on their own
* Checkboxes and radio buttons are captured in the state you clicked them into
* Dropdown options built from ARIA roles are captured as clicks
* Typing descriptions follow the interface language
* Guide titles stay on one line
* Without an AI key, the guide title appears as soon as recording stops
* Blurs cover text to their edges
* The video player in the export preview has its own controls, with play, mute and fullscreen

## [1.2.0](https://github.com/westpoint-io/mimik/compare/v1.1.1...v1.2.0) (2026-09-17)


* Added DeepSeek and OpenRouter as AI providers
* Any AI provider can now point at your own OpenAI-compatible server
* API keys are stored per provider instead of one key shared across all of them
* Checking an API key lists the models that provider offers, and says when the key has no credits left
* An API key can be revealed in settings, so a wrong one can be fixed without retyping it
* A step description that fails now says why, instead of silently retrying
* Each step shows where its description came from
* Guides can be exported as an animated GIF
* Simplified Chinese interface
* PDF export draws non-Latin text with the system fonts, so Chinese, Japanese and Korean characters are no longer clipped
* Typed passwords no longer reach the guide
* Values of blurred fields no longer reach the guide
* Smart Blur matches UK phone numbers, and no longer mistakes reference numbers for them
* A blurred field reveals on click instead of on hover
* Guide Me waits for a real change on input steps that have no saved value
* Settings controls share one height and one text size

## [1.1.1](https://github.com/westpoint-io/mimik/releases/tag/v1.1.1) (2026-08-25)


* Mimik now tells you when it has updated itself, with a link to what changed
