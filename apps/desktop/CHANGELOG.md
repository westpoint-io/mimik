# Changelog

## [1.2.0](https://github.com/westpoint-io/mimik/compare/desktop-v1.1.0...desktop-v1.2.0) (2026-11-05)

### Features

* Linux beta on X11, as an AppImage, deb and rpm. On Wayland, starting a recording explains that it needs an X11 session
* On Linux, steps name the control you clicked and the keys you pressed, as on Windows and macOS
* Update progress in Settings and the tray, with a check a minute after launch and every four hours while Mimik runs
* Edit the AI prompts and add your own instructions for step descriptions and for the guide title and summary, from AI settings
* Send custom headers to your own AI server, set in Settings or onboarding and masked like the key
* Copy selected steps to another guide, or to a new one, from the selection bar
* Japanese, Korean and Traditional Chinese

## [1.1.0](https://github.com/westpoint-io/mimik/compare/desktop-v1.0.0...desktop-v1.1.0) (2026-10-30)

### Features

* Dark mode, following the system or a choice in Settings
* Reorder steps from a contents panel instead of dragging cards
* Step numbers in video and GIF exports
* The default shortcuts are now Alt+Shift+1 to record, 2 to pause and 3 to capture, the same as the extension

### Bug Fixes

* Anthropic works again for step descriptions
* A guide gets a plain title when the AI takes too long to write one
* The video preview timer shows the total length instead of 0:00

## 1.0.0 (2026-10-26)

The first public release of Mimik Desktop, for Windows.

* Record a workflow in any app on your computer, not just the browser. Each click, key and typed field becomes a step with a screenshot and a description.
* Capture the window you click, the whole screen, or an area you draw, from a small card that stays out of the screenshots.
* Edit and export guides as in the extension: PDF, Word, Markdown, HTML, GIF, video, or a `.mimik` file someone else can import.
* AI descriptions and voice narration are optional and use your own key.
* Everything stays on your computer. No account, no telemetry.
* A signed installer that keeps itself up to date.
