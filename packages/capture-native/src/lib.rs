#![deny(clippy::all)]

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Result, Task};
use napi_derive::napi;

#[cfg(any(windows, test))]
mod hit;
#[cfg(windows)]
mod win;

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
  pub rect: Option<ElementRect>,
  pub ancestors: Vec<ElementNode>,
  pub children: Vec<ElementNode>,
}

pub struct ElementLookup {
  at: Option<(i32, i32)>,
}

impl Task for ElementLookup {
  type Output = Option<UiElement>;
  type JsValue = Option<UiElement>;

  #[cfg(windows)]
  fn compute(&mut self) -> Result<Self::Output> {
    match self.at {
      Some((x, y)) => win::element_at_point(x, y),
      None => win::focused_element(),
    }
  }

  #[cfg(not(windows))]
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
  #[cfg(windows)]
  return win::key_label(keycode);
  #[cfg(not(windows))]
  {
    let _ = keycode;
    None
  }
}

#[napi]
pub fn resolve_key(keycode: u32, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  #[cfg(windows)]
  return win::resolve_key(keycode, shift, ctrl, alt);
  #[cfg(not(windows))]
  {
    let _ = (keycode, shift, ctrl, alt);
    None
  }
}

#[napi]
pub fn clear_dead_key() {
  #[cfg(windows)]
  win::clear_dead_key();
}

#[napi]
pub fn is_supported() -> bool {
  cfg!(windows)
}
