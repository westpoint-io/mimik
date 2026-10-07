#![deny(clippy::all)]

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Result, Task};
use napi_derive::napi;

#[cfg(any(windows, test))]
mod hit;
#[cfg(target_os = "macos")]
mod mac;
#[cfg(target_os = "macos")]
mod machook;
#[cfg(any(target_os = "macos", test))]
mod macmap;
#[cfg(windows)]
mod win;
#[cfg(any(windows, test))]
mod window;
#[cfg(target_os = "macos")]
use mac as platform;
#[cfg(windows)]
use win as platform;

#[napi(object)]
pub struct ElementRect {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
}

#[napi(object)]
pub struct ElementNode {
  pub role: Option<String>,
  pub name: Option<String>,
}

#[napi(object)]
pub struct UiElement {
  pub role: Option<String>,
  pub name: Option<String>,
  pub automation_id: Option<String>,
  pub value: Option<String>,
  pub help_text: Option<String>,
  pub is_password: bool,
  pub value_length: Option<u32>,
  pub rect: Option<ElementRect>,
  pub ancestors: Vec<ElementNode>,
  pub children: Vec<ElementNode>,
}

#[napi(object)]
pub struct ActiveWindow {
  pub title: Option<String>,
  pub app_name: String,
  pub app_path: Option<String>,
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
  pub on_menu: bool,
}

#[napi(object)]
pub struct HookEvent {
  pub kind: String,
  pub button: u32,
  pub x: f64,
  pub y: f64,
  pub clicks: u32,
  pub keycode: u32,
  pub shift: bool,
  pub ctrl: bool,
  pub alt: bool,
  pub meta: bool,
}

pub type HookCallback =
  napi::threadsafe_function::ThreadsafeFunction<HookEvent, (), HookEvent, napi::Status, false, true>;

#[napi(ts_args_type = "callback: (event: HookEvent) => void")]
pub fn start_input_hook(callback: HookCallback) -> Result<()> {
  #[cfg(target_os = "macos")]
  return machook::start(callback);
  #[cfg(not(target_os = "macos"))]
  {
    drop(callback);
    Err(napi::Error::from_reason("the native input hook is macOS only"))
  }
}

pub struct ElementLookup {
  at: Option<(i32, i32)>,
}

impl Task for ElementLookup {
  type Output = Option<UiElement>;
  type JsValue = Option<UiElement>;

  #[cfg(any(windows, target_os = "macos"))]
  fn compute(&mut self) -> Result<Self::Output> {
    match self.at {
      Some((x, y)) => platform::element_at_point(x, y),
      None => platform::focused_element(),
    }
  }

  #[cfg(not(any(windows, target_os = "macos")))]
  fn compute(&mut self) -> Result<Self::Output> {
    Ok(None)
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi(ts_return_type = "Promise<UiElement | null>")]
pub fn element_at_point(x: i32, y: i32) -> AsyncTask<ElementLookup> {
  AsyncTask::new(ElementLookup { at: Some((x, y)) })
}

#[napi(ts_return_type = "Promise<UiElement | null>")]
pub fn focused_element() -> AsyncTask<ElementLookup> {
  AsyncTask::new(ElementLookup { at: None })
}

#[napi]
pub fn key_label(keycode: u32) -> Option<String> {
  #[cfg(any(windows, target_os = "macos"))]
  return platform::key_label(keycode);
  #[cfg(not(any(windows, target_os = "macos")))]
  {
    let _ = keycode;
    None
  }
}

#[napi]
pub fn resolve_key(keycode: u32, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  #[cfg(any(windows, target_os = "macos"))]
  return platform::resolve_key(keycode, shift, ctrl, alt);
  #[cfg(not(any(windows, target_os = "macos")))]
  {
    let _ = (keycode, shift, ctrl, alt);
    None
  }
}

#[napi]
pub fn active_window() -> Option<ActiveWindow> {
  #[cfg(any(windows, target_os = "macos"))]
  return platform::active_window();
  #[cfg(not(any(windows, target_os = "macos")))]
  None
}

#[napi]
pub fn window_at(x: i32, y: i32) -> Option<ActiveWindow> {
  #[cfg(any(windows, target_os = "macos"))]
  return platform::window_at(x, y);
  #[cfg(not(any(windows, target_os = "macos")))]
  {
    let _ = (x, y);
    None
  }
}

#[napi]
pub fn clear_dead_key() {
  #[cfg(any(windows, target_os = "macos"))]
  platform::clear_dead_key();
}

#[napi]
pub fn release_web_content() {
  #[cfg(target_os = "macos")]
  platform::release_web_content();
}

#[napi]
pub fn is_supported() -> bool {
  cfg!(any(windows, target_os = "macos"))
}
