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
