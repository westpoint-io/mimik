use std::collections::HashSet;
use std::ffi::{c_char, c_void, CStr};
use std::path::Path;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;

use napi::Result;

use crate::macmap::{is_control, is_label, mac_keycode, named_key, printable, role, PROMOTE_DEPTH};
use crate::{ActiveWindow, ElementNode, ElementRect, UiElement};

type CFTypeRef = *const c_void;
type CFStringRef = *const c_void;
type CFArrayRef = *const c_void;
type CFDictionaryRef = *const c_void;
type AXUIElementRef = *const c_void;
type AXError = i32;
type Boolean = u8;

const UTF8: u32 = 0x0800_0100;
const AX_POINT: u32 = 1;
const AX_SIZE: u32 = 2;
const NUMBER_INT32: isize = 3;
const NUMBER_FLOAT64: isize = 6;
const ON_SCREEN_ONLY: u32 = 1;
const EXCLUDE_DESKTOP: u32 = 16;
const MESSAGING_TIMEOUT_SECONDS: f32 = 1.0;
const MAX_ANCESTORS: usize = 4;
const MAX_CHILDREN: usize = 12;

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CGPoint {
  x: f64,
  y: f64,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CGSize {
  width: f64,
  height: f64,
}

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CGRect {
  origin: CGPoint,
  size: CGSize,
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
  fn CFRelease(value: CFTypeRef);
  fn CFGetTypeID(value: CFTypeRef) -> usize;
  fn CFStringGetTypeID() -> usize;
  fn CFArrayGetTypeID() -> usize;
  fn CFStringCreateWithBytes(
    allocator: *const c_void,
    bytes: *const u8,
    length: isize,
    encoding: u32,
    external: Boolean,
  ) -> CFStringRef;
  fn CFStringGetLength(string: CFStringRef) -> isize;
  fn CFStringGetMaximumSizeForEncoding(length: isize, encoding: u32) -> isize;
  fn CFStringGetCString(string: CFStringRef, buffer: *mut c_char, size: isize, encoding: u32) -> Boolean;
  fn CFArrayGetCount(array: CFArrayRef) -> isize;
  fn CFArrayGetValueAtIndex(array: CFArrayRef, index: isize) -> *const c_void;
  fn CFDictionaryGetValue(dictionary: CFDictionaryRef, key: *const c_void) -> *const c_void;
  fn CFNumberGetValue(number: CFTypeRef, kind: isize, value: *mut c_void) -> Boolean;
  fn CFDataGetBytePtr(data: CFTypeRef) -> *const u8;
  static kCFBooleanTrue: CFTypeRef;
}

#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
  fn AXUIElementCreateSystemWide() -> AXUIElementRef;
  fn AXUIElementCreateApplication(pid: i32) -> AXUIElementRef;
  fn AXUIElementCopyElementAtPosition(
    application: AXUIElementRef,
    x: f32,
    y: f32,
    element: *mut AXUIElementRef,
  ) -> AXError;
  fn AXUIElementCopyAttributeValue(
    element: AXUIElementRef,
    attribute: CFStringRef,
    value: *mut CFTypeRef,
  ) -> AXError;
  fn AXUIElementSetAttributeValue(
    element: AXUIElementRef,
    attribute: CFStringRef,
    value: CFTypeRef,
  ) -> AXError;
  fn AXUIElementSetMessagingTimeout(element: AXUIElementRef, seconds: f32) -> AXError;
  fn AXUIElementGetPid(element: AXUIElementRef, pid: *mut i32) -> AXError;
  fn AXValueGetValue(value: CFTypeRef, kind: u32, out: *mut c_void) -> Boolean;
}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
  fn CGWindowListCopyWindowInfo(option: u32, relative_to: u32) -> CFArrayRef;
  fn CGRectMakeWithDictionaryRepresentation(dictionary: CFDictionaryRef, rect: *mut CGRect) -> bool;
  fn CGEventSourceFlagsState(state: i32) -> u64;
  static kCGWindowLayer: CFStringRef;
  static kCGWindowBounds: CFStringRef;
  static kCGWindowOwnerPID: CFStringRef;
  static kCGWindowOwnerName: CFStringRef;
  static kCGWindowName: CFStringRef;
  static kCGWindowAlpha: CFStringRef;
}

#[link(name = "Carbon", kind = "framework")]
extern "C" {
  fn TISCopyCurrentKeyboardLayoutInputSource() -> CFTypeRef;
  fn TISCopyCurrentASCIICapableKeyboardLayoutInputSource() -> CFTypeRef;
  fn TISGetInputSourceProperty(source: CFTypeRef, key: CFStringRef) -> CFTypeRef;
  fn LMGetKbdType() -> u8;
  fn UCKeyTranslate(
    layout: *const u8,
    keycode: u16,
    action: u16,
    modifiers: u32,
    keyboard: u32,
    options: u32,
    dead_key: *mut u32,
    max: usize,
    length: *mut usize,
    text: *mut u16,
  ) -> i32;
  static kTISPropertyUnicodeKeyLayoutData: CFStringRef;
}

extern "C" {
  fn proc_pidpath(pid: i32, buffer: *mut c_void, size: u32) -> i32;
}

struct Owned(CFTypeRef);

impl Owned {
  fn new(value: CFTypeRef) -> Option<Self> {
    (!value.is_null()).then_some(Self(value))
  }
}

impl Drop for Owned {
  fn drop(&mut self) {
    unsafe { CFRelease(self.0) };
  }
}

fn cf_string(text: &str) -> Owned {
  Owned(unsafe { CFStringCreateWithBytes(std::ptr::null(), text.as_ptr(), text.len() as isize, UTF8, 0) })
}

fn clean(value: String) -> Option<String> {
  let trimmed = value.trim();
  (!trimmed.is_empty()).then(|| trimmed.to_string())
}

fn string_of(value: CFTypeRef) -> Option<String> {
  if value.is_null() || unsafe { CFGetTypeID(value) != CFStringGetTypeID() } {
    return None;
  }
  let length = unsafe { CFStringGetLength(value) };
  let size = unsafe { CFStringGetMaximumSizeForEncoding(length, UTF8) } + 1;
  let mut buffer = vec![0 as c_char; size as usize];
  if unsafe { CFStringGetCString(value, buffer.as_mut_ptr(), size, UTF8) } == 0 {
    return None;
  }
  let text = unsafe { CStr::from_ptr(buffer.as_ptr()) };
  clean(text.to_string_lossy().into_owned())
}

fn attribute(element: AXUIElementRef, name: &str) -> Option<Owned> {
  let key = cf_string(name);
  let mut value: CFTypeRef = std::ptr::null();
  let read = unsafe { AXUIElementCopyAttributeValue(element, key.0, &mut value) };
  if read == 0 {
    Owned::new(value)
  } else {
    None
  }
}

fn text(element: AXUIElementRef, name: &str) -> Option<String> {
  attribute(element, name).and_then(|value| string_of(value.0))
}

fn ax_value<T: Default>(element: AXUIElementRef, name: &str, kind: u32) -> Option<T> {
  let value = attribute(element, name)?;
  let mut out = T::default();
  (unsafe { AXValueGetValue(value.0, kind, (&mut out as *mut T).cast()) } != 0).then_some(out)
}

fn rect_of(element: AXUIElementRef) -> Option<ElementRect> {
  let origin: CGPoint = ax_value(element, "AXPosition", AX_POINT)?;
  let size: CGSize = ax_value(element, "AXSize", AX_SIZE)?;
  (size.width > 0.0 && size.height > 0.0).then_some(ElementRect {
    x: origin.x,
    y: origin.y,
    width: size.width,
    height: size.height,
  })
}

fn role_of(element: AXUIElementRef) -> Option<String> {
  role(
    text(element, "AXRole").as_deref(),
    text(element, "AXSubrole").as_deref(),
  )
}

fn secure(element: AXUIElementRef) -> bool {
  text(element, "AXSubrole").as_deref() == Some("AXSecureTextField")
}

fn label_of(element: AXUIElementRef) -> Option<String> {
  text(element, "AXTitle")
    .or_else(|| text(element, "AXDescription"))
    .or_else(|| {
      let title = attribute(element, "AXTitleUIElement")?;
      text(title.0, "AXValue").or_else(|| text(title.0, "AXTitle"))
    })
}

fn describe(element: AXUIElementRef) -> UiElement {
  let is_password = secure(element);
  UiElement {
    role: role_of(element),
    name: label_of(element),
    automation_id: text(element, "AXIdentifier"),
    value: if is_password {
      None
    } else {
      text(element, "AXValue")
    },
    help_text: text(element, "AXHelp").or_else(|| text(element, "AXPlaceholderValue")),
    is_password,
    rect: rect_of(element),
    ancestors: Vec::new(),
    children: Vec::new(),
  }
}

fn node(element: AXUIElementRef) -> ElementNode {
  ElementNode {
    role: role_of(element),
    name: label_of(element),
  }
}

fn parent(element: AXUIElementRef) -> Option<Owned> {
  attribute(element, "AXParent")
}

fn ancestors(element: AXUIElementRef) -> Vec<ElementNode> {
  let mut out = Vec::new();
  let mut current = parent(element);
  while let Some(found) = current {
    if out.len() == MAX_ANCESTORS {
      break;
    }
    out.push(node(found.0));
    current = parent(found.0);
  }
  out
}

fn children(element: AXUIElementRef) -> Vec<ElementNode> {
  let Some(list) = attribute(element, "AXChildren") else {
    return Vec::new();
  };
  if unsafe { CFGetTypeID(list.0) != CFArrayGetTypeID() } {
    return Vec::new();
  }
  let count = unsafe { CFArrayGetCount(list.0) }.min(MAX_CHILDREN as isize);
  (0..count)
    .map(|index| node(unsafe { CFArrayGetValueAtIndex(list.0, index) }))
    .collect()
}

fn promoted(hit: Owned) -> Owned {
  if !is_label(role_of(hit.0).as_deref()) {
    return hit;
  }
  let mut current = parent(hit.0);
  for _ in 0..PROMOTE_DEPTH {
    let Some(found) = current else { break };
    if is_control(role_of(found.0).as_deref()) {
      return found;
    }
    current = parent(found.0);
  }
  hit
}

static OPENED: Mutex<Option<HashSet<i32>>> = Mutex::new(None);

fn pid_of(element: AXUIElementRef) -> Option<i32> {
  let mut pid = 0;
  (unsafe { AXUIElementGetPid(element, &mut pid) } == 0).then_some(pid)
}

fn ours(element: AXUIElementRef) -> bool {
  pid_of(element) == Some(std::process::id() as i32)
}

fn open_web_content(element: AXUIElementRef) -> bool {
  let Some(pid) = pid_of(element).filter(|_| !ours(element)) else {
    return false;
  };
  let mut opened = OPENED.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  if !opened.get_or_insert_with(HashSet::new).insert(pid) {
    return false;
  }
  let Some(app) = Owned::new(unsafe { AXUIElementCreateApplication(pid) }) else {
    return false;
  };
  let key = cf_string("AXManualAccessibility");
  unsafe { AXUIElementSetAttributeValue(app.0, key.0, kCFBooleanTrue) == 0 }
}

fn system() -> Option<Owned> {
  let wide = Owned::new(unsafe { AXUIElementCreateSystemWide() })?;
  unsafe { AXUIElementSetMessagingTimeout(wide.0, MESSAGING_TIMEOUT_SECONDS) };
  Some(wide)
}

fn hit_test(wide: &Owned, x: i32, y: i32) -> Option<Owned> {
  let mut found: AXUIElementRef = std::ptr::null();
  let read = unsafe { AXUIElementCopyElementAtPosition(wide.0, x as f32, y as f32, &mut found) };
  if read == 0 {
    Owned::new(found)
  } else {
    None
  }
}

pub fn element_at_point(x: i32, y: i32) -> Result<Option<UiElement>> {
  let Some(wide) = system() else { return Ok(None) };
  let Some(mut hit) = hit_test(&wide, x, y).filter(|found| !ours(found.0)) else {
    return Ok(None);
  };
  if open_web_content(hit.0) {
    if let Some(again) = hit_test(&wide, x, y) {
      hit = again;
    }
  }
  let found = promoted(hit);
  let mut element = describe(found.0);
  if element.name.is_none() {
    element.ancestors = ancestors(found.0);
    element.children = children(found.0);
  }
  Ok(Some(element))
}

pub fn focused_element() -> Result<Option<UiElement>> {
  let Some(wide) = system() else { return Ok(None) };
  Ok(attribute(wide.0, "AXFocusedUIElement").map(|found| describe(found.0)))
}

static DEAD_KEY: AtomicU32 = AtomicU32::new(0);

const SHIFT: u32 = 1 << 9;
const CAPS: u32 = 1 << 10;
const OPTION: u32 = 1 << 11;
const CONTROL: u32 = 1 << 12;
const NO_DEAD_KEYS: u32 = 1;
const CAPS_FLAG: u64 = 0x0001_0000;
const COMBINED_SESSION: i32 = 0;

fn translate(keycode: u16, modifiers: u32, options: u32, dead_key: &mut u32) -> Option<String> {
  let source = Owned::new(unsafe { TISCopyCurrentKeyboardLayoutInputSource() })?;
  let mut data = unsafe { TISGetInputSourceProperty(source.0, kTISPropertyUnicodeKeyLayoutData) };
  let _fallback;
  if data.is_null() {
    let ascii = Owned::new(unsafe { TISCopyCurrentASCIICapableKeyboardLayoutInputSource() })?;
    data = unsafe { TISGetInputSourceProperty(ascii.0, kTISPropertyUnicodeKeyLayoutData) };
    _fallback = ascii;
  }
  if data.is_null() {
    return None;
  }
  let layout = unsafe { CFDataGetBytePtr(data) };
  let mut buffer = [0u16; 8];
  let mut length = 0usize;
  let status = unsafe {
    UCKeyTranslate(
      layout,
      keycode,
      0,
      (modifiers >> 8) & 0xff,
      u32::from(LMGetKbdType()),
      options,
      dead_key,
      buffer.len(),
      &mut length,
      buffer.as_mut_ptr(),
    )
  };
  if status != 0 || length == 0 {
    return None;
  }
  String::from_utf16(&buffer[..length]).ok()
}

pub fn key_label(keycode: u32) -> Option<String> {
  if let Some(name) = named_key(keycode) {
    return Some(name);
  }
  let mac = mac_keycode(keycode)?;
  [0, SHIFT].iter().find_map(|&modifiers| {
    let mut ignored = 0;
    translate(mac, modifiers, NO_DEAD_KEYS, &mut ignored)
      .filter(|found| found.chars().count() == 1 && found.chars().all(|found| found.is_ascii_alphanumeric()))
      .map(|found| found.to_ascii_uppercase())
  })
}

pub fn resolve_key(keycode: u32, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  let mac = mac_keycode(keycode)?;
  let mut modifiers = 0;
  if shift {
    modifiers |= SHIFT;
  }
  if alt {
    modifiers |= OPTION;
  }
  if ctrl {
    modifiers |= CONTROL;
  }
  if unsafe { CGEventSourceFlagsState(COMBINED_SESSION) } & CAPS_FLAG != 0 {
    modifiers |= CAPS;
  }
  let mut dead_key = DEAD_KEY.load(Ordering::Relaxed);
  let found = translate(mac, modifiers, 0, &mut dead_key);
  DEAD_KEY.store(dead_key, Ordering::Relaxed);
  found.and_then(|found| printable(&found))
}

pub fn clear_dead_key() {
  DEAD_KEY.store(0, Ordering::Relaxed);
}

struct WindowInfo {
  pid: i32,
  owner: Option<String>,
  title: Option<String>,
  bounds: CGRect,
}

fn number(dictionary: CFDictionaryRef, key: CFStringRef, kind: isize) -> Option<f64> {
  let value = unsafe { CFDictionaryGetValue(dictionary, key) };
  if value.is_null() {
    return None;
  }
  if kind == NUMBER_INT32 {
    let mut out = 0i32;
    (unsafe { CFNumberGetValue(value, kind, (&mut out as *mut i32).cast()) } != 0).then_some(f64::from(out))
  } else {
    let mut out = 0f64;
    (unsafe { CFNumberGetValue(value, kind, (&mut out as *mut f64).cast()) } != 0).then_some(out)
  }
}

fn windows() -> Vec<WindowInfo> {
  let Some(list) = Owned::new(unsafe { CGWindowListCopyWindowInfo(ON_SCREEN_ONLY | EXCLUDE_DESKTOP, 0) })
  else {
    return Vec::new();
  };
  let own = std::process::id() as i32;
  (0..unsafe { CFArrayGetCount(list.0) })
    .filter_map(|index| {
      let entry = unsafe { CFArrayGetValueAtIndex(list.0, index) };
      let layer = number(entry, unsafe { kCGWindowLayer }, NUMBER_INT32)?;
      let alpha = number(entry, unsafe { kCGWindowAlpha }, NUMBER_FLOAT64).unwrap_or(1.0);
      let pid = number(entry, unsafe { kCGWindowOwnerPID }, NUMBER_INT32)? as i32;
      if layer != 0.0 || alpha <= 0.0 || pid == own {
        return None;
      }
      let mut bounds = CGRect::default();
      let dictionary = unsafe { CFDictionaryGetValue(entry, kCGWindowBounds) };
      if dictionary.is_null() || !unsafe { CGRectMakeWithDictionaryRepresentation(dictionary, &mut bounds) } {
        return None;
      }
      (bounds.size.width > 1.0 && bounds.size.height > 1.0).then(|| WindowInfo {
        pid,
        owner: string_of(unsafe { CFDictionaryGetValue(entry, kCGWindowOwnerName) }),
        title: string_of(unsafe { CFDictionaryGetValue(entry, kCGWindowName) }),
        bounds,
      })
    })
    .collect()
}

fn process_path(pid: i32) -> Option<String> {
  let mut buffer = [0u8; 4096];
  let length = unsafe { proc_pidpath(pid, buffer.as_mut_ptr().cast(), buffer.len() as u32) };
  if length <= 0 {
    return None;
  }
  clean(String::from_utf8_lossy(&buffer[..length as usize]).into_owned())
}

fn app_bundle(path: &str) -> String {
  Path::new(path)
    .ancestors()
    .find(|found| found.extension().is_some_and(|extension| extension == "app"))
    .map_or_else(|| path.to_string(), |found| found.to_string_lossy().into_owned())
}

fn framed(found: &WindowInfo) -> ActiveWindow {
  let path = process_path(found.pid).map(|path| app_bundle(&path));
  let app_name = found
    .owner
    .clone()
    .or_else(|| {
      path
        .as_deref()
        .and_then(|found| Path::new(found).file_stem())
        .map(|stem| stem.to_string_lossy().into_owned())
    })
    .unwrap_or_default();
  ActiveWindow {
    title: found.title.clone(),
    app_name,
    app_path: path,
    x: found.bounds.origin.x,
    y: found.bounds.origin.y,
    width: found.bounds.size.width,
    height: found.bounds.size.height,
  }
}

fn frontmost_pid() -> Option<i32> {
  let wide = system()?;
  let app = attribute(wide.0, "AXFocusedApplication")?;
  pid_of(app.0)
}

pub fn active_window() -> Option<ActiveWindow> {
  let all = windows();
  let front = frontmost_pid();
  all
    .iter()
    .find(|found| Some(found.pid) == front)
    .or_else(|| all.first())
    .map(framed)
}

pub fn window_at(x: i32, y: i32) -> Option<ActiveWindow> {
  let (x, y) = (f64::from(x), f64::from(y));
  windows()
    .iter()
    .find(|found| {
      let bounds = found.bounds;
      x >= bounds.origin.x
        && y >= bounds.origin.y
        && x < bounds.origin.x + bounds.size.width
        && y < bounds.origin.y + bounds.size.height
    })
    .map(framed)
}
