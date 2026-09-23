use std::cell::RefCell;

use napi::Result;
use windows::core::{Interface, BSTR};
use windows::Win32::Foundation::POINT;
use windows::Win32::System::Com::{
  CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::*;
use windows::Win32::UI::Input::KeyboardAndMouse::{
  GetKeyState, GetKeyboardLayout, MapVirtualKeyExW, ToUnicodeEx, HKL, MAPVK_VK_TO_VSC, MAPVK_VSC_TO_VK_EX,
  VK_BACK, VK_CAPITAL, VK_CONTROL, VK_DELETE, VK_DOWN, VK_END, VK_ESCAPE, VK_F1, VK_F24, VK_HOME, VK_INSERT,
  VK_LEFT, VK_MENU, VK_NEXT, VK_PRIOR, VK_RETURN, VK_RIGHT, VK_SHIFT, VK_SPACE, VK_TAB, VK_UP,
};
use windows::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowThreadProcessId};

use crate::{ElementNode, ElementRect, UiElement};

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
    rect: rect_of(found),
    ancestors: Vec::new(),
    children: Vec::new(),
  }
}

const MAX_ANCESTORS: usize = 4;
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

pub fn element_at_point(x: i32, y: i32) -> Result<Option<UiElement>> {
  let uia = automation().map_err(|error| napi::Error::from_reason(error.message()))?;
  let found = unsafe { uia.ElementFromPoint(POINT { x, y }) }
    .map_err(|error| napi::Error::from_reason(error.message()))?;
  let mut element = describe(&found);
  if element.name.is_none() {
    if let Ok(walker) = unsafe { uia.ControlViewWalker() } {
      element.ancestors = ancestors(&walker, &found);
      element.children = children(&walker, &found);
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

pub fn reset_dead_key_state() {
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
