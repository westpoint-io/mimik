use std::cell::RefCell;

use napi::Result;
use windows::core::{Interface, BSTR};
use windows::Win32::Foundation::POINT;
use windows::Win32::System::Com::{
  CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_MULTITHREADED,
};
use windows::Win32::UI::Accessibility::*;

use crate::{ElementRect, UiElement};

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

pub fn element_at_point(x: i32, y: i32) -> Result<Option<UiElement>> {
  let found = automation()
    .and_then(|uia| unsafe { uia.ElementFromPoint(POINT { x, y }) })
    .map_err(|error| napi::Error::from_reason(error.message()))?;

  let help = text(unsafe { found.CurrentHelpText() });
  Ok(Some(UiElement {
    role: role(unsafe { found.CurrentControlType() }.unwrap_or_default()),
    name: text(unsafe { found.CurrentName() }),
    automation_id: text(unsafe { found.CurrentAutomationId() }),
    value: value_of(&found),
    help_text: help,
    rect: rect_of(&found),
  }))
}
