# Changelog

## [1.6.0](https://github.com/westpoint-io/mimik/compare/v1.5.0...v1.6.0) (2026-11-05)


### Features

* **ai:** let users edit AI prompts and add their own instructions ([#237](https://github.com/westpoint-io/mimik/issues/237)) ([638e8b4](https://github.com/westpoint-io/mimik/commit/638e8b4dd5a92badce6e1c06851f95c8eab53aaf))
* **ai:** send custom headers to your own AI server ([#226](https://github.com/westpoint-io/mimik/issues/226)) ([d0869bc](https://github.com/westpoint-io/mimik/commit/d0869bc63fb5f8ec4ec67c9ea3a8ccbd638c1912))
* **desktop:** read the clicked control and key labels on linux ([#239](https://github.com/westpoint-io/mimik/issues/239)) ([6d952b0](https://github.com/westpoint-io/mimik/commit/6d952b0bf0e0dffb3f6ec026ce683af33384c1f9))
* **desktop:** ship the desktop app on linux (x11) ([#232](https://github.com/westpoint-io/mimik/issues/232)) ([00dd3e0](https://github.com/westpoint-io/mimik/commit/00dd3e08df58643500ce8f2385693cf7a076e47a))
* **desktop:** show update progress and keep checking for updates while Mimik runs ([#230](https://github.com/westpoint-io/mimik/issues/230)) ([202609f](https://github.com/westpoint-io/mimik/commit/202609fcfb1888dec2e62164c749c2ee22edc255))
* **extension:** add a recording card that runs on the page ([#238](https://github.com/westpoint-io/mimik/issues/238)) ([edffca9](https://github.com/westpoint-io/mimik/commit/edffca9c65c141680b34d740ea1af7756630ec14))
* **i18n:** add Japanese, Korean and Traditional Chinese ([#234](https://github.com/westpoint-io/mimik/issues/234)) ([3275604](https://github.com/westpoint-io/mimik/commit/32756046f2b1b740c93e74bdbdd96b1a4dbb79df))
* **ui:** copy selected steps to another guide ([#224](https://github.com/westpoint-io/mimik/issues/224)) ([701fdd9](https://github.com/westpoint-io/mimik/commit/701fdd9840a1f0887054ee305b0f6148d52b7d67))


### Bug Fixes

* **capture:** stop a typing step from freezing the tab on a field with many attributes ([#236](https://github.com/westpoint-io/mimik/issues/236)) ([4dedb2a](https://github.com/westpoint-io/mimik/commit/4dedb2a2907014104ebeeb037adb23c46e557f3f))
* **ui:** install the animation package the shared overlays expect ([#225](https://github.com/westpoint-io/mimik/issues/225)) ([a2e044b](https://github.com/westpoint-io/mimik/commit/a2e044bf362b086129382037173a4f34d2a59469))

## [1.5.0](https://github.com/westpoint-io/mimik/compare/v1.4.1...v1.5.0) (2026-10-30)

### Features

* Keyboard shortcuts to start or stop recording, pause and capture a step now: Alt+Shift+1, 2 and 3, listed in Settings
* Dark mode, following the system or a choice in Settings
* Reorder steps from a contents panel instead of dragging cards
* Step numbers in video and GIF exports

### Bug Fixes

* Clicking some pages while recording no longer freezes them
* Choosing an item in a menu or dropdown that closes on mouse release records a step
* A click is named after the control it hit, and clicking a field names it
* Anthropic works again for step descriptions
* A guide gets a plain title when the AI takes too long to write one
* Guide Me finds a recorded link again when it holds more text or its address changed
* Menus in Firefox stay open instead of closing straight away
* The onboarding blur preview follows every smart blur switch, including SSN, IP and MAC
* The video preview timer shows the total length instead of 0:00

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
