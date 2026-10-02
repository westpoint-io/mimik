const ROLES: &[(&str, &str)] = &[
  ("AXButton", "button"),
  ("AXMenuButton", "button"),
  ("AXDisclosureTriangle", "button"),
  ("AXColorWell", "button"),
  ("AXCheckBox", "checkbox"),
  ("AXRadioButton", "radio"),
  ("AXTextField", "textbox"),
  ("AXTextArea", "textbox"),
  ("AXDateField", "textbox"),
  ("AXComboBox", "combobox"),
  ("AXPopUpButton", "combobox"),
  ("AXLink", "link"),
  ("AXImage", "img"),
  ("AXStaticText", "text"),
  ("AXHeading", "heading"),
  ("AXMenuItem", "menuitem"),
  ("AXMenuBarItem", "menuitem"),
  ("AXMenu", "menu"),
  ("AXMenuBar", "menubar"),
  ("AXList", "list"),
  ("AXTable", "table"),
  ("AXOutline", "tree"),
  ("AXRow", "row"),
  ("AXCell", "cell"),
  ("AXColumn", "columnheader"),
  ("AXTabGroup", "tablist"),
  ("AXSlider", "slider"),
  ("AXIncrementor", "spinbutton"),
  ("AXProgressIndicator", "progressbar"),
  ("AXLevelIndicator", "progressbar"),
  ("AXScrollBar", "scrollbar"),
  ("AXValueIndicator", "thumb"),
  ("AXToolbar", "toolbar"),
  ("AXGroup", "group"),
  ("AXSplitGroup", "group"),
  ("AXRadioGroup", "group"),
  ("AXScrollArea", "pane"),
  ("AXWebArea", "document"),
  ("AXWindow", "window"),
  ("AXSheet", "window"),
  ("AXHelpTag", "tooltip"),
  ("AXSplitter", "separator"),
];

const SUBROLES: &[(&str, &str)] = &[
  ("AXSwitch", "switch"),
  ("AXTabButton", "tab"),
  ("AXOutlineRow", "treeitem"),
  ("AXSearchField", "textbox"),
  ("AXSecureTextField", "textbox"),
];

const CONTROLS: &[&str] = &[
  "button", "checkbox", "switch", "radio", "link", "menuitem", "tab", "treeitem", "row", "cell", "combobox",
];

pub const PROMOTE_DEPTH: usize = 3;

pub fn role(role: Option<&str>, subrole: Option<&str>) -> Option<String> {
  let find = |table: &[(&str, &str)], key: Option<&str>| {
    key.and_then(|key| {
      table
        .iter()
        .find(|(ax, _)| *ax == key)
        .map(|(_, name)| (*name).to_string())
    })
  };
  find(SUBROLES, subrole).or_else(|| find(ROLES, role))
}

pub fn is_label(role: Option<&str>) -> bool {
  matches!(role, Some("text" | "img"))
}

pub fn is_control(role: Option<&str>) -> bool {
  role.is_some_and(|role| CONTROLS.contains(&role))
}

const KEYCODES: &[(u32, u16)] = &[
  (0x02, 0x12),
  (0x03, 0x13),
  (0x04, 0x14),
  (0x05, 0x15),
  (0x06, 0x17),
  (0x07, 0x16),
  (0x08, 0x1a),
  (0x09, 0x1c),
  (0x0a, 0x19),
  (0x0b, 0x1d),
  (0x0c, 0x1b),
  (0x0d, 0x18),
  (0x10, 0x0c),
  (0x11, 0x0d),
  (0x12, 0x0e),
  (0x13, 0x0f),
  (0x14, 0x11),
  (0x15, 0x10),
  (0x16, 0x20),
  (0x17, 0x22),
  (0x18, 0x1f),
  (0x19, 0x23),
  (0x1a, 0x21),
  (0x1b, 0x1e),
  (0x1e, 0x00),
  (0x1f, 0x01),
  (0x20, 0x02),
  (0x21, 0x03),
  (0x22, 0x05),
  (0x23, 0x04),
  (0x24, 0x26),
  (0x25, 0x28),
  (0x26, 0x25),
  (0x27, 0x29),
  (0x28, 0x27),
  (0x29, 0x32),
  (0x2b, 0x2a),
  (0x2c, 0x06),
  (0x2d, 0x07),
  (0x2e, 0x08),
  (0x2f, 0x09),
  (0x30, 0x0b),
  (0x31, 0x2d),
  (0x32, 0x2e),
  (0x33, 0x2b),
  (0x34, 0x2f),
  (0x35, 0x2c),
  (0x39, 0x31),
  (0x56, 0x0a),
];

const NAMED_KEYS: &[(u32, &str)] = &[
  (0x1c, "Enter"),
  (0x0f, "Tab"),
  (0x01, "Escape"),
  (0x0e, "Backspace"),
  (0x39, "Space"),
  (0x0e53, "Delete"),
  (0x0e52, "Insert"),
  (0x0e47, "Home"),
  (0x0e4f, "End"),
  (0x0e49, "PageUp"),
  (0x0e51, "PageDown"),
  (0xe048, "ArrowUp"),
  (0xe050, "ArrowDown"),
  (0xe04b, "ArrowLeft"),
  (0xe04d, "ArrowRight"),
];

const FUNCTION_KEYS: &[(u32, u8)] = &[
  (0x3b, 1),
  (0x3c, 2),
  (0x3d, 3),
  (0x3e, 4),
  (0x3f, 5),
  (0x40, 6),
  (0x41, 7),
  (0x42, 8),
  (0x43, 9),
  (0x44, 10),
  (0x57, 11),
  (0x58, 12),
];

const MAC_ONLY_KEYS: &[(u16, u32)] = &[
  (0x24, 0x1c),
  (0x4c, 0x0e1c),
  (0x30, 0x0f),
  (0x35, 0x01),
  (0x33, 0x0e),
  (0x75, 0x0e53),
  (0x72, 0x0e52),
  (0x73, 0x0e47),
  (0x77, 0x0e4f),
  (0x74, 0x0e49),
  (0x79, 0x0e51),
  (0x7e, 0xe048),
  (0x7d, 0xe050),
  (0x7b, 0xe04b),
  (0x7c, 0xe04d),
  (0x7a, 0x3b),
  (0x78, 0x3c),
  (0x63, 0x3d),
  (0x76, 0x3e),
  (0x60, 0x3f),
  (0x61, 0x40),
  (0x62, 0x41),
  (0x64, 0x42),
  (0x65, 0x43),
  (0x6d, 0x44),
  (0x67, 0x57),
  (0x6f, 0x58),
];

pub fn hook_keycode(mac: u16) -> u32 {
  KEYCODES
    .iter()
    .find(|(_, found)| *found == mac)
    .map(|(vc, _)| *vc)
    .or_else(|| {
      MAC_ONLY_KEYS
        .iter()
        .find(|(found, _)| *found == mac)
        .map(|(_, vc)| *vc)
    })
    .unwrap_or(0)
}

pub fn mac_keycode(keycode: u32) -> Option<u16> {
  KEYCODES
    .iter()
    .find(|(vc, _)| *vc == keycode)
    .map(|(_, mac)| *mac)
}

pub fn named_key(keycode: u32) -> Option<String> {
  if let Some((_, name)) = NAMED_KEYS.iter().find(|(vc, _)| *vc == keycode) {
    return Some((*name).to_string());
  }
  FUNCTION_KEYS
    .iter()
    .find(|(vc, _)| *vc == keycode)
    .map(|(_, number)| format!("F{number}"))
}

pub const MENU_BAR_LAYER: f64 = 24.0;

pub struct LayeredWindow {
  pub pid: i32,
  pub layer: f64,
  pub under_point: bool,
}

pub fn window_for_click(windows: &[LayeredWindow], front: Option<i32>) -> Option<(usize, bool)> {
  let hit = windows.iter().find(|found| found.under_point)?;
  if hit.layer == 0.0 {
    return windows
      .iter()
      .position(|found| found.under_point)
      .map(|index| (index, false));
  }
  let front = front?;
  if hit.pid != front && hit.layer != MENU_BAR_LAYER {
    return None;
  }
  windows
    .iter()
    .position(|found| found.layer == 0.0 && found.pid == front)
    .map(|index| (index, true))
}

pub fn printable(text: &str) -> Option<String> {
  (!text.is_empty() && text.chars().all(|found| !found.is_control())).then(|| text.to_string())
}

#[cfg(test)]
mod tests {
  use super::{
    hook_keycode, is_control, is_label, mac_keycode, named_key, printable, role, window_for_click,
    LayeredWindow, MENU_BAR_LAYER,
  };

  #[test]
  fn mac_keys_come_back_as_hook_codes() {
    assert_eq!(hook_keycode(0x00), 0x1e);
    assert_eq!(hook_keycode(0x24), 0x1c);
    assert_eq!(hook_keycode(0x33), 0x0e);
    assert_eq!(hook_keycode(0x7b), 0xe04b);
    assert_eq!(hook_keycode(0x6f), 0x58);
    assert_eq!(hook_keycode(0xff), 0);
    for vc in [0x1e, 0x10, 0x02, 0x0b, 0x35] {
      assert_eq!(hook_keycode(mac_keycode(vc).unwrap()), vc);
    }
  }

  #[test]
  fn subroles_win_over_roles() {
    assert_eq!(
      role(Some("AXCheckBox"), Some("AXSwitch")).as_deref(),
      Some("switch")
    );
    assert_eq!(
      role(Some("AXRadioButton"), Some("AXTabButton")).as_deref(),
      Some("tab")
    );
    assert_eq!(
      role(Some("AXRow"), Some("AXOutlineRow")).as_deref(),
      Some("treeitem")
    );
    assert_eq!(
      role(Some("AXCheckBox"), Some("AXUnknown")).as_deref(),
      Some("checkbox")
    );
  }

  #[test]
  fn unknown_roles_are_null() {
    assert_eq!(role(Some("AXLayoutArea"), None), None);
    assert_eq!(role(None, None), None);
  }

  #[test]
  fn text_inside_a_control_is_a_label() {
    assert!(is_label(Some("text")));
    assert!(is_label(Some("img")));
    assert!(!is_label(Some("button")));
    assert!(is_control(Some("button")));
    assert!(!is_control(Some("group")));
    assert!(!is_control(None));
  }

  #[test]
  fn hook_codes_map_to_mac_virtual_keys() {
    assert_eq!(mac_keycode(0x1e), Some(0x00));
    assert_eq!(mac_keycode(0x10), Some(0x0c));
    assert_eq!(mac_keycode(0x0b), Some(0x1d));
    assert_eq!(mac_keycode(0xe048), None);
  }

  #[test]
  fn named_and_function_keys_skip_the_layout() {
    assert_eq!(named_key(0x1c).as_deref(), Some("Enter"));
    assert_eq!(named_key(0xe04b).as_deref(), Some("ArrowLeft"));
    assert_eq!(named_key(0x58).as_deref(), Some("F12"));
    assert_eq!(named_key(0x1e), None);
  }

  fn window(pid: i32, layer: f64, under_point: bool) -> LayeredWindow {
    LayeredWindow {
      pid,
      layer,
      under_point,
    }
  }

  #[test]
  fn menus_belong_to_the_app_in_front() {
    let menu_over_another_app = [
      window(7, 101.0, true),
      window(7, 0.0, false),
      window(9, 0.0, true),
    ];
    assert_eq!(window_for_click(&menu_over_another_app, Some(7)), Some((1, true)));
    let menu_over_its_own_app = [window(7, 101.0, true), window(7, 0.0, true)];
    assert_eq!(window_for_click(&menu_over_its_own_app, Some(7)), Some((1, true)));
    let menu_bar = [
      window(0, MENU_BAR_LAYER, true),
      window(9, 0.0, false),
      window(7, 0.0, false),
    ];
    assert_eq!(window_for_click(&menu_bar, Some(7)), Some((2, true)));
    let plain = [window(9, 0.0, true), window(7, 0.0, true)];
    assert_eq!(window_for_click(&plain, Some(7)), Some((0, false)));
    let dock = [window(3, 20.0, true), window(7, 0.0, true)];
    assert_eq!(window_for_click(&dock, Some(7)), None);
    assert_eq!(window_for_click(&menu_bar, None), None);
  }

  #[test]
  fn control_characters_are_not_typing() {
    assert_eq!(printable("é").as_deref(), Some("é"));
    assert_eq!(printable("\u{13}"), None);
    assert_eq!(printable(""), None);
  }
}
