# Changelog

## [1.1.0](https://github.com/westpoint-io/mimik/compare/desktop-v1.0.0...desktop-v1.1.0) (2026-10-30)


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
* **i18n:** fit the russian store description in 132 characters ([#196](https://github.com/westpoint-io/mimik/issues/196)) ([890b6dc](https://github.com/westpoint-io/mimik/commit/890b6dc5a966833562ce24bf7012b4d9dc6b7557))
* **ui:** keep menus open when firefox refocuses their trigger ([#208](https://github.com/westpoint-io/mimik/issues/208)) ([8b6d0d5](https://github.com/westpoint-io/mimik/commit/8b6d0d5666597ed274939166ef260d4f4121c4fc))
* **ui:** make the onboarding blur preview follow every smart blur preset ([#217](https://github.com/westpoint-io/mimik/issues/217)) ([5114336](https://github.com/westpoint-io/mimik/commit/5114336679a4f8005ce386622d7aebc7f524aa8c))
* **ui:** show the total length in the video preview timer ([#218](https://github.com/westpoint-io/mimik/issues/218)) ([2d5db7a](https://github.com/westpoint-io/mimik/commit/2d5db7a727c8efcf08dc189b3ff36b2d7aea34f6))

## 1.0.0 (2026-10-26)

The first public release of Mimik Desktop, for Windows.

* Record a workflow in any app on your computer, not just the browser. Each click, key and typed field becomes a step with a screenshot and a description.
* Capture the window you click, the whole screen, or an area you draw, from a small card that stays out of the screenshots.
* Edit and export guides as in the extension: PDF, Word, Markdown, HTML, GIF, video, or a `.mimik` file someone else can import.
* AI descriptions and voice narration are optional and use your own key.
* Everything stays on your computer. No account, no telemetry.
* A signed installer that keeps itself up to date.
