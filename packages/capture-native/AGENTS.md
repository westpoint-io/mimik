# @mimik/capture-native

A napi-rs addon that does only what no prebuilt npm package does: the control under a point and the
focused control, from UIAutomation on Windows and the accessibility API on macOS, plus window
lookup, key labels and the macOS event tap. Screenshots, displays and the Windows/Linux input hook
come from npm packages. Do not add them here.

- Linux answers from AT-SPI on the session's accessibility bus (`atspi.rs`, roles in `atspimap.rs`)
  over a blocking zbus connection with a 300 ms timeout per call. `enable_accessibility` switches
  the bus on at launch and leaves it on, because toolkits only join it when they start after that.
  The X window under the point names the app (`_NET_CLIENT_LIST_STACKING`; a server-side title bar
  is the frame's parent), then override-redirect menu windows and GNOME Shell's overlay layers are
  checked before the app's own tree. GTK4 reports window coordinates and everything else screen
  ones, so `placement()` calibrates per app, and GTK4 and Qt lack Collection, so the walk there is
  manual. Known gaps: Qt menus built on the fly, Flutter apps, and web page content beyond a
  browser's own controls. Key labels come from the X keymap through xkbcommon (`linux.rs`).
  `x11.rs` keeps the overlay jobs: GNOME Shell draws its dock and top bar above every managed
  window, so the area editor is made override-redirect (`floatAboveShell`) and given keyboard focus
  by hand (`focusWindow`), since the window manager ignores it. Electron already makes non-focusable
  windows override-redirect. Check every X request with `.check()`: a request left unchecked can be
  lost when the short-lived connection closes.
- `pnpm --filter @mimik/capture-native build:windows` cross-compiles from Linux with `cargo-xwin`.
  macOS binaries need Apple's SDK, so on Linux type-check with
  `cargo clippy --target x86_64-apple-darwin` (and `aarch64-apple-darwin`).
- Rules without FFI live in `hit.rs`, `window.rs`, `keys.rs`, `macmap.rs` and `atspimap.rs`, so `cargo test` runs them on
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
