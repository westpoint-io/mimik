use std::cell::RefCell;

use x11rb::connection::Connection;
use x11rb::protocol::xkb::{ConnectionExt as _, ID};
use x11rb::protocol::xproto::{AtomEnum, ConnectionExt as _, Window};
use x11rb::rust_connection::RustConnection;
use xkbcommon::xkb;

use crate::keys::{named_key, printable};

const LAST_EVDEV_KEY: u32 = 0x58;
const EVDEV_TO_X11: u32 = 8;

struct Keyboard {
  conn: RustConnection,
  root: Window,
  names: Vec<u8>,
  keymap: xkb::Keymap,
}

thread_local! {
  static KEYBOARD: RefCell<Option<Keyboard>> = const { RefCell::new(None) };
}

fn rules_names(conn: &RustConnection, root: Window) -> Option<Vec<u8>> {
  let atom = conn
    .intern_atom(true, b"_XKB_RULES_NAMES")
    .ok()?
    .reply()
    .ok()?
    .atom;
  let reply = conn
    .get_property(false, root, atom, AtomEnum::STRING, 0, 1024)
    .ok()?
    .reply()
    .ok()?;
  (!reply.value.is_empty()).then_some(reply.value)
}

fn compile(names: &[u8]) -> Option<xkb::Keymap> {
  let parts: Vec<String> = names
    .split(|byte| *byte == 0)
    .map(|part| String::from_utf8_lossy(part).into_owned())
    .collect();
  let part = |index: usize| parts.get(index).cloned().unwrap_or_default();
  let options = Some(part(4)).filter(|found| !found.is_empty());
  let context = xkb::Context::new(xkb::CONTEXT_NO_FLAGS);
  xkb::Keymap::new_from_names(
    &context,
    &part(0),
    &part(1),
    &part(2),
    &part(3),
    options,
    xkb::KEYMAP_COMPILE_NO_FLAGS,
  )
}

fn connect() -> Option<Keyboard> {
  let (conn, screen) = RustConnection::connect(None).ok()?;
  let root = conn.setup().roots.get(screen)?.root;
  conn.xkb_use_extension(1, 0).ok()?.reply().ok()?;
  let names = rules_names(&conn, root)?;
  let keymap = compile(&names)?;
  Some(Keyboard {
    conn,
    root,
    names,
    keymap,
  })
}

fn with_state<T>(
  mods: impl FnOnce(&xkb::Keymap) -> xkb::ModMask,
  read: impl FnOnce(&xkb::State) -> Option<T>,
) -> Option<T> {
  KEYBOARD.with(|cell| {
    let mut slot = cell.borrow_mut();
    if slot.is_none() {
      *slot = connect();
    }
    let keyboard = slot.as_mut()?;
    if let Some(names) = rules_names(&keyboard.conn, keyboard.root) {
      if names != keyboard.names {
        keyboard.keymap = compile(&names)?;
        keyboard.names = names;
      }
    }
    let Some(current) = keyboard
      .conn
      .xkb_get_state(ID::USE_CORE_KBD.into())
      .ok()
      .and_then(|cookie| cookie.reply().ok())
    else {
      *slot = None;
      return None;
    };
    let mut state = xkb::State::new(&keyboard.keymap);
    let locked = u16::from(current.locked_mods) as xkb::ModMask;
    state.update_mask(
      mods(&keyboard.keymap),
      0,
      locked,
      0,
      0,
      u8::from(current.group) as xkb::LayoutIndex,
    );
    read(&state)
  })
}

fn modifier(keymap: &xkb::Keymap, name: &str) -> xkb::ModMask {
  match keymap.mod_get_index(name) {
    xkb::MOD_INVALID => 0,
    index => 1 << index,
  }
}

fn x11_keycode(keycode: u32) -> Option<xkb::Keycode> {
  (1..=LAST_EVDEV_KEY)
    .contains(&keycode)
    .then(|| xkb::Keycode::new(keycode + EVDEV_TO_X11))
}

fn text(keycode: xkb::Keycode, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  let mods = |keymap: &xkb::Keymap| {
    [
      (shift, xkb::MOD_NAME_SHIFT),
      (ctrl, xkb::MOD_NAME_CTRL),
      (alt, xkb::MOD_NAME_ALT),
    ]
    .iter()
    .filter(|(held, _)| *held)
    .fold(0, |mask, (_, name)| mask | modifier(keymap, name))
  };
  with_state(mods, |state| Some(state.key_get_utf8(keycode)))
}

pub fn key_label(keycode: u32) -> Option<String> {
  if let Some(name) = named_key(keycode) {
    return Some(name);
  }
  let x11 = x11_keycode(keycode)?;
  [false, true].iter().find_map(|&shift| {
    text(x11, shift, false, false)
      .filter(|found| found.chars().count() == 1 && found.chars().all(|found| found.is_ascii_alphanumeric()))
      .map(|found| found.to_ascii_uppercase())
  })
}

pub fn resolve_key(keycode: u32, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  text(x11_keycode(keycode)?, shift, ctrl, alt).and_then(|found| printable(&found))
}

pub fn clear_dead_key() {}

pub fn element_at_point(x: i32, y: i32) -> napi::Result<Option<crate::UiElement>> {
  Ok(crate::atspi::element_at_point(x, y))
}

pub fn focused_element() -> napi::Result<Option<crate::UiElement>> {
  Ok(crate::atspi::focused_element())
}

pub fn release_web_content() {
  crate::atspi::release();
}
