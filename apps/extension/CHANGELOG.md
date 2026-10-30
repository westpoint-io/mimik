# Changelog

## [1.5.0](https://github.com/westpoint-io/mimik/compare/v1.4.1...v1.5.0) (2026-10-30)


### Features

* **capture:** add keyboard shortcuts to the extension ([#219](https://github.com/westpoint-io/mimik/issues/219)) ([506c0a1](https://github.com/westpoint-io/mimik/commit/506c0a1f4791e1e37b20597cfe1247c26d32c44d))
* **export:** number the steps in video and gif exports ([#215](https://github.com/westpoint-io/mimik/issues/215)) ([f4192da](https://github.com/westpoint-io/mimik/commit/f4192daf671aa11cc4256758ce64a36aee7c2488))
* **ui:** add a dark mode that follows the system or a saved choice ([#216](https://github.com/westpoint-io/mimik/issues/216)) ([2b708b8](https://github.com/westpoint-io/mimik/commit/2b708b86126fbb199a3b93a1a0ae645c1eb00000))
* **ui:** reorder steps from a contents panel instead of dragging cards ([#209](https://github.com/westpoint-io/mimik/issues/209)) ([373f44c](https://github.com/westpoint-io/mimik/commit/373f44ca20f369a6aa042371e2eb1fe70139ec82))


### Bug Fixes

* **capture:** make anthropic work again for capture requests ([#205](https://github.com/westpoint-io/mimik/issues/205)) ([224fa4c](https://github.com/westpoint-io/mimik/commit/224fa4c3f4e81d5cb9598fbbfae16c990b20a228))
* **capture:** record choices in menus and dropdowns that close on mouse release ([#207](https://github.com/westpoint-io/mimik/issues/207)) ([da87906](https://github.com/westpoint-io/mimik/commit/da87906d7d471770b0efdcb9e3a85236e341875b))
* **capture:** resolve clicks to the real control and name fields when clicked ([#206](https://github.com/westpoint-io/mimik/issues/206)) ([d03e715](https://github.com/westpoint-io/mimik/commit/d03e715eeee44733fdaf5a9c0cc86eb895e71cb0))
* **capture:** stop recording from freezing the page ([#214](https://github.com/westpoint-io/mimik/issues/214)) ([b17c72c](https://github.com/westpoint-io/mimik/commit/b17c72c376e4efb5d39f10ecac7c09690fc5b692))
* fall back to a plain guide title when the model takes too long ([#203](https://github.com/westpoint-io/mimik/issues/203)) ([8b17451](https://github.com/westpoint-io/mimik/commit/8b17451ebc665daac49601b61c6d174c53579b5e))
* **github:** stop the issue forms from adding needs-triage ([#202](https://github.com/westpoint-io/mimik/issues/202)) ([4cd790b](https://github.com/westpoint-io/mimik/commit/4cd790bab134a26265c01f939a7365fe84a0434a))
* **guideme:** find a recorded link again when it holds more text or its address changes ([#220](https://github.com/westpoint-io/mimik/issues/220)) ([d84525a](https://github.com/westpoint-io/mimik/commit/d84525a0734f87c8ad924e85eb9511d9d19df624))
* **ui:** keep menus open when firefox refocuses their trigger ([#208](https://github.com/westpoint-io/mimik/issues/208)) ([8b6d0d5](https://github.com/westpoint-io/mimik/commit/8b6d0d5666597ed274939166ef260d4f4121c4fc))
* **ui:** make the onboarding blur preview follow every smart blur preset ([#217](https://github.com/westpoint-io/mimik/issues/217)) ([5114336](https://github.com/westpoint-io/mimik/commit/5114336679a4f8005ce386622d7aebc7f524aa8c))
* **ui:** show the total length in the video preview timer ([#218](https://github.com/westpoint-io/mimik/issues/218)) ([2d5db7a](https://github.com/westpoint-io/mimik/commit/2d5db7a727c8efcf08dc189b3ff36b2d7aea34f6))

## [1.4.1](https://github.com/westpoint-io/mimik/compare/v1.4.0...v1.4.1) (2026-10-27)


### Bug Fixes

* **i18n:** fit the russian store description in 132 characters ([#196](https://github.com/westpoint-io/mimik/issues/196)) ([890b6dc](https://github.com/westpoint-io/mimik/commit/890b6dc5a966833562ce24bf7012b4d9dc6b7557))

## [1.4.0](https://github.com/westpoint-io/mimik/compare/v1.3.0...v1.4.0) (2026-10-26)


### Features

* Russian interface, with step descriptions written in Russian
* A redesigned onboarding, and existing users see the thank-you letter once
* You choose whether AI writes step descriptions, guide titles or both
* Settings to record keyboard shortcuts and what you type, both off by default
* Typing steps name the field you typed in
* A recording can be discarded instead of finished
* More kinds of steps are captured
* The dashboard moves to a sidebar, and the library and its thumbnails fill the page
* Search opens near the top and lists your recent guides
* The options page shows one section at a time and has an About section and a GitHub card
* Narration and voice-over settings sit under AI, with a live microphone meter
* API key checks show as pills inside the field, and a provider with no key is flagged
* The version appears beside Settings, and the top bar fits narrow windows

### Bug Fixes

* Nothing is sent to the AI provider for steps when AI is off for steps
* Page overlays no longer build HTML from strings, and the blur picker button is translated
* Typing, key and colour settings apply to a recording that is already running
* Shortcut steps are named with the held keys, as Ctrl+K
* A click made just before pausing or finishing is kept
* A new step is numbered from the steps that exist, so deleting one leaves no gap
* Exports get their own brand colour, separate from the click highlight
* Russian has its own date format, AI instructions and prompt examples
* Mimik never injects into the Chrome Web Store
* The dashboard's Start capture button starts a new capture
* A narration that hears nothing ends with a calm note, and narration turns off when the microphone is refused
* Naming and merging steps wait for narration to finish
* Security updates for fflate, the AI SDK and DOMPurify

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
