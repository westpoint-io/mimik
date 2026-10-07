use std::ffi::c_void;
use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::{mpsc, OnceLock};
use std::time::Duration;

use napi::threadsafe_function::ThreadsafeFunctionCallMode;
use napi::Result;

use crate::macmap::hook_keycode;
use crate::{HookCallback, HookEvent};

type CFTypeRef = *const c_void;
type CGEventRef = *const c_void;

#[repr(C)]
#[derive(Default, Clone, Copy)]
struct CGPoint {
  x: f64,
  y: f64,
}

type TapCallback = extern "C" fn(*const c_void, u32, CGEventRef, *mut c_void) -> CGEventRef;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
  fn CGEventTapCreate(
    tap: u32,
    place: u32,
    options: u32,
    events: u64,
    callback: TapCallback,
    info: *mut c_void,
  ) -> CFTypeRef;
  fn CGEventTapEnable(tap: CFTypeRef, enable: bool);
  fn CGEventGetLocation(event: CGEventRef) -> CGPoint;
  fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
  fn CGEventGetFlags(event: CGEventRef) -> u64;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
  fn CFMachPortCreateRunLoopSource(allocator: *const c_void, port: CFTypeRef, order: isize) -> CFTypeRef;
  fn CFRunLoopGetCurrent() -> CFTypeRef;
  fn CFRunLoopAddSource(run_loop: CFTypeRef, source: CFTypeRef, mode: CFTypeRef);
  fn CFRunLoopRun();
  static kCFRunLoopCommonModes: CFTypeRef;
}

const SESSION_TAP: u32 = 1;
const HEAD_INSERT: u32 = 0;
const ACTIVE_TAP: u32 = 0;
const LEFT_DOWN: u32 = 1;
const RIGHT_DOWN: u32 = 3;
const OTHER_DOWN: u32 = 25;
const KEY_DOWN: u32 = 10;
const DISABLED_BY_TIMEOUT: u32 = 0xFFFF_FFFE;
const DISABLED_BY_USER: u32 = 0xFFFF_FFFF;
const CLICK_STATE: u32 = 1;
const KEYCODE: u32 = 9;
const SHIFT: u64 = 1 << 17;
const CONTROL: u64 = 1 << 18;
const OPTION: u64 = 1 << 19;
const COMMAND: u64 = 1 << 20;
const START_TIMEOUT: Duration = Duration::from_secs(3);

static CALLBACK: OnceLock<HookCallback> = OnceLock::new();
static TAP: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());

fn event(kind: &str, button: u32, at: CGPoint, clicks: i64, keycode: u32, flags: u64) -> HookEvent {
  HookEvent {
    kind: kind.to_string(),
    button,
    x: at.x,
    y: at.y,
    clicks: clicks.max(1) as u32,
    keycode,
    shift: flags & SHIFT != 0,
    ctrl: flags & CONTROL != 0,
    alt: flags & OPTION != 0,
    meta: flags & COMMAND != 0,
  }
}

extern "C" fn on_event(_proxy: *const c_void, kind: u32, raw: CGEventRef, _info: *mut c_void) -> CGEventRef {
  if kind == DISABLED_BY_TIMEOUT || kind == DISABLED_BY_USER {
    let tap = TAP.load(Ordering::Acquire);
    if !tap.is_null() {
      unsafe { CGEventTapEnable(tap, true) };
    }
    return raw;
  }
  let Some(callback) = CALLBACK.get() else {
    return raw;
  };
  let flags = unsafe { CGEventGetFlags(raw) };
  let found = match kind {
    LEFT_DOWN | RIGHT_DOWN | OTHER_DOWN => {
      let button = match kind {
        LEFT_DOWN => 1,
        RIGHT_DOWN => 2,
        _ => 3,
      };
      let at = unsafe { CGEventGetLocation(raw) };
      let clicks = unsafe { CGEventGetIntegerValueField(raw, CLICK_STATE) };
      Some(event("click", button, at, clicks, 0, flags))
    }
    KEY_DOWN => {
      let mac = unsafe { CGEventGetIntegerValueField(raw, KEYCODE) } as u16;
      Some(event(
        "keydown",
        0,
        CGPoint::default(),
        1,
        hook_keycode(mac),
        flags,
      ))
    }
    _ => None,
  };
  if let Some(found) = found {
    callback.call(found, ThreadsafeFunctionCallMode::NonBlocking);
  }
  raw
}

pub fn start(callback: HookCallback) -> Result<()> {
  if CALLBACK.set(callback).is_err() {
    return Ok(());
  }
  let (ready, started) = mpsc::channel::<bool>();
  std::thread::spawn(move || {
    let mask = (1u64 << LEFT_DOWN) | (1u64 << RIGHT_DOWN) | (1u64 << OTHER_DOWN) | (1u64 << KEY_DOWN);
    let tap = unsafe {
      CGEventTapCreate(
        SESSION_TAP,
        HEAD_INSERT,
        ACTIVE_TAP,
        mask,
        on_event,
        std::ptr::null_mut(),
      )
    };
    if tap.is_null() {
      let _ = ready.send(false);
      return;
    }
    TAP.store(tap as *mut c_void, Ordering::Release);
    unsafe {
      let source = CFMachPortCreateRunLoopSource(std::ptr::null(), tap, 0);
      CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
      CGEventTapEnable(tap, true);
    }
    let _ = ready.send(true);
    unsafe { CFRunLoopRun() };
  });
  match started.recv_timeout(START_TIMEOUT) {
    Ok(true) => Ok(()),
    Ok(false) => Err(napi::Error::from_reason(
      "macOS refused the event tap: Mimik needs Accessibility permission",
    )),
    Err(_) => Err(napi::Error::from_reason("the event tap did not start")),
  }
}
