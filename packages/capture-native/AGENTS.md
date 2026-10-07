# @mimik/capture-native

A napi-rs addon that does only what no prebuilt npm package does: the control under a point and the
focused control, from UIAutomation on Windows and the accessibility API on macOS, plus window
lookup, key labels and the macOS event tap. Screenshots, displays and the Windows/Linux input hook
come from npm packages. Do not add them here.

- Linux builds the crate and answers `null`, or `is_supported() == false`. Callers treat that the
  same as a missing binary.
- `pnpm --filter @mimik/capture-native build:windows` cross-compiles from Linux with `cargo-xwin`.
  macOS binaries need Apple's SDK, so on Linux type-check with
  `cargo clippy --target x86_64-apple-darwin` (and `aarch64-apple-darwin`).
- Rules without FFI live in `hit.rs`, `window.rs` and `macmap.rs`, so `cargo test` runs them on
  Linux. Put new pure logic there.
- UIAutomation calls run on the libuv threadpool (`AsyncTask`), never on Electron's main thread. The
  keyboard calls are synchronous on purpose, because macOS input sources must be read on the main
  thread.
- Rectangles from Windows are physical pixels. Convert with `dipToScreenPoint` and `screenToDipRect`.
  macOS points are already DIP.
- A password field's value is dropped at the addon boundary. Only its length crosses.
- A hit is not always the control. Windows narrows any hit with children to the smallest element
  under the point. macOS does the same for an empty, unnamed group, such as Chromium's tab-drag
  layer. Both use `smallest_under`.
- Before committing: `cargo fmt --check`, `cargo clippy` for both Mac targets, and `cargo test`.
