#![deny(clippy::all)]

use napi::bindgen_prelude::AsyncTask;
use napi::{Env, Result, Task};
use napi_derive::napi;

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
pub struct UiElement {
  pub role: Option<String>,
  pub name: Option<String>,
  pub automation_id: Option<String>,
  pub value: Option<String>,
  pub help_text: Option<String>,
  pub rect: Option<ElementRect>,
}

pub struct ElementAtPoint {
  x: i32,
  y: i32,
}

impl Task for ElementAtPoint {
  type Output = Option<UiElement>;
  type JsValue = Option<UiElement>;

  #[cfg(windows)]
  fn compute(&mut self) -> Result<Self::Output> {
    win::element_at_point(self.x, self.y)
  }

  #[cfg(not(windows))]
  fn compute(&mut self) -> Result<Self::Output> {
    let _ = (self.x, self.y);
    Ok(None)
  }

  fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
    Ok(output)
  }
}

#[napi(ts_return_type = "Promise<UiElement | null>")]
pub fn element_at_point(x: i32, y: i32) -> AsyncTask<ElementAtPoint> {
  AsyncTask::new(ElementAtPoint { x, y })
}

#[napi]
pub fn is_supported() -> bool {
  cfg!(windows)
}
