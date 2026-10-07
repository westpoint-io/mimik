use std::cell::RefCell;
use std::ffi::c_void;
use std::path::Path;

use napi::Result;
use windows::core::{Interface, BOOL, BSTR, PCWSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, POINT, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows::Win32::Graphics::Gdi::{
  GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::Storage::FileSystem::{GetFileVersionInfoSizeW, GetFileVersionInfoW, VerQueryValueW};
use windows::Win32::System::Com::{
  CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::System::Threading::{
  OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::*;
use windows::Win32::UI::Input::KeyboardAndMouse::{
  GetKeyState, GetKeyboardLayout, MapVirtualKeyExW, ToUnicodeEx, HKL, MAPVK_VK_TO_VSC, MAPVK_VSC_TO_VK_EX,
  VK_BACK, VK_CAPITAL, VK_CONTROL, VK_DELETE, VK_DOWN, VK_END, VK_ESCAPE, VK_F1, VK_F24, VK_HOME, VK_INSERT,
  VK_LEFT, VK_MENU, VK_NEXT, VK_PRIOR, VK_RETURN, VK_RIGHT, VK_SHIFT, VK_SPACE, VK_TAB, VK_UP,
};
use windows::Win32::UI::WindowsAndMessaging::{
  EnumWindows, GetAncestor, GetClassNameW, GetForegroundWindow, GetWindow, GetWindowLongPtrW, GetWindowRect,
  GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible, WindowFromPoint, GA_ROOT, GWL_EXSTYLE,
  GWL_STYLE, GW_OWNER, WS_CAPTION, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_POPUP, WS_SYSMENU,
};

use crate::hit::smallest_under;
use crate::window::{fills, is_popup, Edges, Traits};
use crate::{ActiveWindow, ElementNode, ElementRect, UiElement};

const ROLES: &[(UIA_CONTROLTYPE_ID, &str)] = &[
  (UIA_ButtonControlTypeId, "button"),
  (UIA_CalendarControlTypeId, "calendar"),
  (UIA_CheckBoxControlTypeId, "checkbox"),
  (UIA_ComboBoxControlTypeId, "combobox"),
  (UIA_EditControlTypeId, "textbox"),
  (UIA_HyperlinkControlTypeId, "link"),
  (UIA_ImageControlTypeId, "img"),
  (UIA_ListItemControlTypeId, "listitem"),
  (UIA_ListControlTypeId, "list"),
  (UIA_MenuControlTypeId, "menu"),
  (UIA_MenuBarControlTypeId, "menubar"),
  (UIA_MenuItemControlTypeId, "menuitem"),
  (UIA_ProgressBarControlTypeId, "progressbar"),
  (UIA_RadioButtonControlTypeId, "radio"),
  (UIA_ScrollBarControlTypeId, "scrollbar"),
  (UIA_SliderControlTypeId, "slider"),
  (UIA_SpinnerControlTypeId, "spinbutton"),
  (UIA_StatusBarControlTypeId, "status"),
  (UIA_TabControlTypeId, "tablist"),
  (UIA_TabItemControlTypeId, "tab"),
  (UIA_TextControlTypeId, "text"),
  (UIA_ToolBarControlTypeId, "toolbar"),
  (UIA_ToolTipControlTypeId, "tooltip"),
  (UIA_TreeControlTypeId, "tree"),
  (UIA_TreeItemControlTypeId, "treeitem"),
  (UIA_GroupControlTypeId, "group"),
  (UIA_ThumbControlTypeId, "thumb"),
  (UIA_DataGridControlTypeId, "grid"),
  (UIA_DataItemControlTypeId, "row"),
  (UIA_DocumentControlTypeId, "document"),
  (UIA_SplitButtonControlTypeId, "button"),
  (UIA_WindowControlTypeId, "window"),
  (UIA_PaneControlTypeId, "pane"),
  (UIA_HeaderControlTypeId, "rowgroup"),
  (UIA_HeaderItemControlTypeId, "columnheader"),
  (UIA_TableControlTypeId, "table"),
  (UIA_TitleBarControlTypeId, "banner"),
  (UIA_SeparatorControlTypeId, "separator"),
  (UIA_AppBarControlTypeId, "toolbar"),
];

thread_local! {
  static AUTOMATION: RefCell<Option<IUIAutomation>> = const { RefCell::new(None) };
}

fn automation() -> windows::core::Result<IUIAutomation> {
  AUTOMATION.with(|cell| {
    if let Some(found) = cell.borrow().as_ref() {
      return Ok(found.clone());
    }
    unsafe {
      let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
    let created: IUIAutomation = unsafe { CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER)? };
    *cell.borrow_mut() = Some(created.clone());
    Ok(created)
  })
}

fn clean(value: String) -> Option<String> {
  let trimmed = value.trim();
  if trimmed.is_empty() {
    None
  } else {
    Some(trimmed.to_string())
  }
}

fn text(value: windows::core::Result<BSTR>) -> Option<String> {
  clean(value.ok()?.to_string())
}

fn role(id: UIA_CONTROLTYPE_ID) -> Option<String> {
  ROLES
    .iter()
    .find(|(key, _)| key.0 == id.0)
    .map(|(_, name)| (*name).to_string())
}

fn value_of(element: &IUIAutomationElement) -> Option<String> {
  let pattern = unsafe { element.GetCurrentPattern(UIA_ValuePatternId) }.ok()?;
  let value = pattern.cast::<IUIAutomationValuePattern>().ok()?;
  text(unsafe { value.CurrentValue() })
}

fn rect_of(element: &IUIAutomationElement) -> Option<ElementRect> {
  let found = unsafe { element.CurrentBoundingRectangle() }.ok()?;
  let width = f64::from(found.right - found.left);
  let height = f64::from(found.bottom - found.top);
  if width <= 0.0 || height <= 0.0 {
    return None;
  }
  Some(ElementRect {
    x: f64::from(found.left),
    y: f64::from(found.top),
    width,
    height,
  })
}

fn describe(found: &IUIAutomationElement) -> UiElement {
  UiElement {
    role: role(unsafe { found.CurrentControlType() }.unwrap_or_default()),
    name: text(unsafe { found.CurrentName() }),
    automation_id: text(unsafe { found.CurrentAutomationId() }),
    value: value_of(found),
    help_text: text(unsafe { found.CurrentHelpText() }),
    is_password: unsafe { found.CurrentIsPassword() }
      .map(|flag| flag.as_bool())
      .unwrap_or(false),
    value_length: None,
    rect: rect_of(found),
    ancestors: Vec::new(),
    children: Vec::new(),
  }
}

const MAX_ANCESTORS: usize = 4;
const TAB_DRAG_LAYER: &str = "TabDragContextImpl";
const MAX_CHILDREN: usize = 12;

fn node(element: &IUIAutomationElement) -> ElementNode {
  ElementNode {
    role: role(unsafe { element.CurrentControlType() }.unwrap_or_default()),
    name: text(unsafe { element.CurrentName() }),
  }
}

fn ancestors(walker: &IUIAutomationTreeWalker, element: &IUIAutomationElement) -> Vec<ElementNode> {
  let mut out = Vec::new();
  let mut current = element.clone();
  while out.len() < MAX_ANCESTORS {
    let Ok(parent) = (unsafe { walker.GetParentElement(&current) }) else {
      break;
    };
    out.push(node(&parent));
    current = parent;
  }
  out
}

fn children(walker: &IUIAutomationTreeWalker, element: &IUIAutomationElement) -> Vec<ElementNode> {
  let mut out = Vec::new();
  let mut next = unsafe { walker.GetFirstChildElement(element) };
  while let Ok(child) = next {
    if out.len() == MAX_CHILDREN {
      break;
    }
    out.push(node(&child));
    next = unsafe { walker.GetNextSiblingElement(&child) };
  }
  out
}

fn narrowest(
  uia: &IUIAutomation,
  walker: &IUIAutomationTreeWalker,
  hit: &IUIAutomationElement,
  point: POINT,
) -> Option<IUIAutomationElement> {
  if unsafe { hit.CurrentControlType() }.ok()? == UIA_EditControlTypeId {
    return None;
  }
  unsafe { walker.GetFirstChildElement(hit) }.ok()?;
  let request = unsafe { uia.CreateCacheRequest() }.ok()?;
  unsafe { request.AddProperty(UIA_BoundingRectanglePropertyId) }.ok()?;
  unsafe { request.AddProperty(UIA_ClassNamePropertyId) }.ok()?;
  let everything = unsafe { uia.CreateTrueCondition() }.ok()?;
  let found = unsafe { hit.FindAllBuildCache(TreeScope_Subtree, &everything, &request) }.ok()?;
  let elements: Vec<IUIAutomationElement> = (0..unsafe { found.Length() }.ok()?)
    .filter_map(|index| unsafe { found.GetElement(index) }.ok())
    .collect();
  let boxes: Vec<_> = elements
    .iter()
    .map(|element| {
      let class = unsafe { element.CachedClassName() }
        .map(|name| name.to_string())
        .unwrap_or_default();
      if class.contains(TAB_DRAG_LAYER) {
        return Default::default();
      }
      unsafe { element.CachedBoundingRectangle() }
        .map(|rect| (rect.left, rect.top, rect.right, rect.bottom))
        .unwrap_or_default()
    })
    .collect();
  smallest_under(&boxes, point.x, point.y).map(|index| elements[index].clone())
}

pub fn element_at_point(x: i32, y: i32) -> Result<Option<UiElement>> {
  let uia = automation().map_err(|error| napi::Error::from_reason(error.message()))?;
  let point = POINT { x, y };
  let hit =
    unsafe { uia.ElementFromPoint(point) }.map_err(|error| napi::Error::from_reason(error.message()))?;
  let walker = unsafe { uia.ControlViewWalker() }.ok();
  let found = walker
    .as_ref()
    .and_then(|walker| narrowest(&uia, walker, &hit, point))
    .unwrap_or(hit);
  let mut element = describe(&found);
  if element.name.is_none() {
    if let Some(walker) = &walker {
      element.ancestors = ancestors(walker, &found);
      element.children = children(walker, &found);
    }
  }
  Ok(Some(element))
}

pub fn focused_element() -> Result<Option<UiElement>> {
  let found = automation()
    .and_then(|uia| unsafe { uia.GetFocusedElement() })
    .map_err(|error| napi::Error::from_reason(error.message()))?;
  Ok(Some(describe(&found)))
}

const NAMED_KEYS: &[(u16, &str)] = &[
  (VK_RETURN.0, "Enter"),
  (VK_TAB.0, "Tab"),
  (VK_ESCAPE.0, "Escape"),
  (VK_BACK.0, "Backspace"),
  (VK_SPACE.0, "Space"),
  (VK_DELETE.0, "Delete"),
  (VK_INSERT.0, "Insert"),
  (VK_HOME.0, "Home"),
  (VK_END.0, "End"),
  (VK_PRIOR.0, "PageUp"),
  (VK_NEXT.0, "PageDown"),
  (VK_UP.0, "ArrowUp"),
  (VK_DOWN.0, "ArrowDown"),
  (VK_LEFT.0, "ArrowLeft"),
  (VK_RIGHT.0, "ArrowRight"),
];

const EXTENDED: u32 = 0xe00;

fn foreground_layout() -> HKL {
  let window = unsafe { GetForegroundWindow() };
  let thread = unsafe { GetWindowThreadProcessId(window, None) };
  unsafe { GetKeyboardLayout(thread) }
}

pub fn key_label(keycode: u32) -> Option<String> {
  let extended = keycode >= EXTENDED;
  let scancode = if extended {
    0xe000 | (keycode - EXTENDED)
  } else {
    keycode
  };
  let vk = unsafe { MapVirtualKeyExW(scancode, MAPVK_VSC_TO_VK_EX, Some(foreground_layout())) } as u16;
  if vk == 0 {
    return None;
  }
  if let Some((_, name)) = NAMED_KEYS.iter().find(|(key, _)| *key == vk) {
    return Some((*name).to_string());
  }
  if (VK_F1.0..=VK_F24.0).contains(&vk) {
    return Some(format!("F{}", vk - VK_F1.0 + 1));
  }
  if vk < 128 && (vk as u8).is_ascii_alphanumeric() {
    return Some((vk as u8 as char).to_string());
  }
  None
}

fn virtual_key(keycode: u32, layout: HKL) -> u16 {
  let extended = keycode >= EXTENDED;
  let scancode = if extended {
    0xe000 | (keycode - EXTENDED)
  } else {
    keycode
  };
  unsafe { MapVirtualKeyExW(scancode, MAPVK_VSC_TO_VK_EX, Some(layout)) as u16 }
}

pub fn resolve_key(keycode: u32, shift: bool, ctrl: bool, alt: bool) -> Option<String> {
  let layout = foreground_layout();
  let vk = virtual_key(keycode, layout);
  if vk == 0 {
    return None;
  }
  let mut state = [0u8; 256];
  if shift {
    state[VK_SHIFT.0 as usize] = 0x80;
  }
  if ctrl {
    state[VK_CONTROL.0 as usize] = 0x80;
  }
  if alt {
    state[VK_MENU.0 as usize] = 0x80;
  }
  if unsafe { GetKeyState(VK_CAPITAL.0 as i32) } & 1 == 1 {
    state[VK_CAPITAL.0 as usize] = 0x01;
  }
  let scancode = unsafe { MapVirtualKeyExW(vk as u32, MAPVK_VK_TO_VSC, Some(layout)) };
  let mut buffer = [0u16; 8];
  let written = unsafe { ToUnicodeEx(vk as u32, scancode, &state, &mut buffer, 0, Some(layout)) };
  if written <= 0 {
    return None;
  }
  String::from_utf16(&buffer[..written as usize])
    .ok()
    .filter(|found| !found.is_empty())
}

pub fn clear_dead_key() {
  let layout = foreground_layout();
  let vk = VK_SPACE.0 as u32;
  let scancode = unsafe { MapVirtualKeyExW(vk, MAPVK_VK_TO_VSC, Some(layout)) };
  let state = [0u8; 256];
  let mut buffer = [0u16; 8];
  for _ in 0..4 {
    if unsafe { ToUnicodeEx(vk, scancode, &state, &mut buffer, 0, Some(layout)) } >= 0 {
      break;
    }
  }
}

fn area(rect: &RECT) -> f64 {
  f64::from((rect.right - rect.left).max(0)) * f64::from((rect.bottom - rect.top).max(0))
}

fn window_rect(window: HWND) -> Option<RECT> {
  let mut rect = RECT::default();
  unsafe { GetWindowRect(window, &mut rect) }.ok()?;
  Some(rect)
}

fn frame_rect(window: HWND) -> Option<RECT> {
  let mut rect = RECT::default();
  let framed = unsafe {
    DwmGetWindowAttribute(
      window,
      DWMWA_EXTENDED_FRAME_BOUNDS,
      (&mut rect as *mut RECT).cast::<c_void>(),
      size_of::<RECT>() as u32,
    )
  };
  if framed.is_ok() && area(&rect) > 0.0 {
    Some(rect)
  } else {
    window_rect(window)
  }
}

fn edges(rect: &RECT) -> Edges {
  Edges {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
  }
}

fn fills_its_monitor(window: HWND, bounds: &RECT) -> bool {
  let monitor = unsafe { MonitorFromWindow(window, MONITOR_DEFAULTTONEAREST) };
  let mut info = MONITORINFO {
    cbSize: size_of::<MONITORINFO>() as u32,
    ..Default::default()
  };
  unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool() && fills(edges(bounds), edges(&info.rcWork))
}

fn text_of(read: impl FnOnce(&mut [u16]) -> i32) -> Option<String> {
  let mut buffer = [0u16; 512];
  let length = read(&mut buffer);
  if length <= 0 {
    return None;
  }
  clean(String::from_utf16_lossy(&buffer[..length as usize]))
}

fn style(window: HWND) -> u32 {
  unsafe { GetWindowLongPtrW(window, GWL_STYLE) as u32 }
}

fn owned(window: HWND) -> bool {
  unsafe { GetWindow(window, GW_OWNER) }.is_ok_and(|owner| !owner.is_invalid())
}

fn cloaked(window: HWND) -> bool {
  let mut flag = 0u32;
  let read = unsafe {
    DwmGetWindowAttribute(
      window,
      DWMWA_CLOAKED,
      (&mut flag as *mut u32).cast::<c_void>(),
      size_of::<u32>() as u32,
    )
  };
  read.is_ok() && flag != 0
}

fn popup(window: HWND) -> bool {
  let class = text_of(|buffer| unsafe { GetClassNameW(window, buffer) }).unwrap_or_default();
  let style = style(window);
  let extended = unsafe { GetWindowLongPtrW(window, GWL_EXSTYLE) as u32 };
  is_popup(&Traits {
    class: &class,
    owned: owned(window),
    no_activate: extended & WS_EX_NOACTIVATE.0 != 0,
    tool_window: extended & WS_EX_TOOLWINDOW.0 != 0,
    captionless_popup: style & WS_POPUP.0 != 0 && style & WS_CAPTION.0 != WS_CAPTION.0,
  })
}

fn process_of(window: HWND) -> u32 {
  let mut process = 0u32;
  unsafe { GetWindowThreadProcessId(window, Some(&mut process)) };
  process
}

fn main_window_of(process: u32) -> Option<HWND> {
  struct Search {
    process: u32,
    best: Option<(f64, HWND)>,
  }
  unsafe extern "system" fn visit(window: HWND, data: LPARAM) -> BOOL {
    let search = unsafe { &mut *(data.0 as *mut Search) };
    let style = style(window);
    let candidate = process_of(window) == search.process
      && unsafe { IsWindowVisible(window) }.as_bool()
      && !cloaked(window)
      && !owned(window)
      && style & WS_CAPTION.0 != 0
      && style & WS_SYSMENU.0 != 0;
    if let Some(rect) = window_rect(window).filter(|_| candidate) {
      let size = area(&rect);
      if search.best.is_none_or(|(largest, _)| size > largest) {
        search.best = Some((size, window));
      }
    }
    true.into()
  }
  let mut search = Search { process, best: None };
  let _ = unsafe { EnumWindows(Some(visit), LPARAM(&mut search as *mut Search as isize)) };
  search.best.map(|(_, window)| window)
}

fn process_path(process: u32) -> Option<String> {
  let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process) }.ok()?;
  let mut buffer = [0u16; 1024];
  let mut length = buffer.len() as u32;
  let named = unsafe {
    QueryFullProcessImageNameW(
      handle,
      PROCESS_NAME_WIN32,
      PWSTR(buffer.as_mut_ptr()),
      &mut length,
    )
  };
  let _ = unsafe { CloseHandle(handle) };
  named.ok()?;
  clean(String::from_utf16_lossy(&buffer[..length as usize]))
}

fn wide(text: &str) -> Vec<u16> {
  text.encode_utf16().chain(Some(0)).collect()
}

fn file_description(path: &str) -> Option<String> {
  let file = wide(path);
  let size = unsafe { GetFileVersionInfoSizeW(PCWSTR(file.as_ptr()), None) };
  if size == 0 {
    return None;
  }
  let mut data = vec![0u8; size as usize];
  unsafe { GetFileVersionInfoW(PCWSTR(file.as_ptr()), None, size, data.as_mut_ptr().cast()) }.ok()?;
  let query = |key: &str| -> Option<(*const u16, usize)> {
    let key = wide(key);
    let mut found: *mut c_void = std::ptr::null_mut();
    let mut length = 0u32;
    let hit = unsafe {
      VerQueryValueW(
        data.as_ptr().cast(),
        PCWSTR(key.as_ptr()),
        &mut found,
        &mut length,
      )
    };
    (hit.as_bool() && length > 0 && !found.is_null()).then_some((found as *const u16, length as usize))
  };
  let (translation, _) = query("\\VarFileInfo\\Translation")?;
  let (language, codepage) = unsafe { (*translation, *translation.add(1)) };
  let (text, length) = query(&format!(
    "\\StringFileInfo\\{language:04x}{codepage:04x}\\FileDescription"
  ))?;
  let characters = unsafe { std::slice::from_raw_parts(text, length) };
  clean(
    String::from_utf16_lossy(characters)
      .trim_end_matches('\0')
      .to_string(),
  )
}

pub fn active_window() -> Option<ActiveWindow> {
  framed(unsafe { GetForegroundWindow() })
}

pub fn window_at(x: i32, y: i32) -> Option<ActiveWindow> {
  let hit = unsafe { WindowFromPoint(POINT { x, y }) };
  if hit.is_invalid() {
    return None;
  }
  framed(unsafe { GetAncestor(hit, GA_ROOT) })
}

fn framed(front: HWND) -> Option<ActiveWindow> {
  if front.is_invalid() {
    return None;
  }
  let process = process_of(front);
  let bounds = frame_rect(front)?;
  let window = if !fills_its_monitor(front, &bounds) && popup(front) {
    main_window_of(process).unwrap_or(front)
  } else {
    front
  };
  let rect = if window == front {
    bounds
  } else {
    frame_rect(window)?
  };
  let path = process_path(process);
  let app_name = path
    .as_deref()
    .and_then(file_description)
    .or_else(|| {
      path
        .as_deref()
        .and_then(|found| Path::new(found).file_stem())
        .map(|stem| stem.to_string_lossy().into_owned())
    })
    .unwrap_or_default();
  Some(ActiveWindow {
    title: text_of(|buffer| unsafe { GetWindowTextW(window, buffer) }),
    app_name,
    app_path: path,
    x: f64::from(rect.left),
    y: f64::from(rect.top),
    width: f64::from(rect.right - rect.left),
    height: f64::from(rect.bottom - rect.top),
    on_menu: false,
  })
}
