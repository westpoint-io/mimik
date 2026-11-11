pub type Bounds = (i32, i32, i32, i32);

pub fn smallest_under(boxes: &[Bounds], x: i32, y: i32) -> Option<usize> {
  boxes
    .iter()
    .enumerate()
    .filter(|(_, &(left, top, right, bottom))| {
      right > left && bottom > top && (left..right).contains(&x) && (top..bottom).contains(&y)
    })
    .min_by_key(|(_, &(left, top, right, bottom))| i64::from(right - left) * i64::from(bottom - top))
    .map(|(index, _)| index)
}

const CONTROLS: &[&str] = &[
  "button", "checkbox", "switch", "radio", "link", "menuitem", "tab", "treeitem", "row", "cell", "combobox",
  "listitem",
];

pub const PROMOTE_DEPTH: usize = 3;

pub fn is_label(role: Option<&str>) -> bool {
  matches!(role, Some("text" | "img"))
}

pub fn is_control(role: Option<&str>) -> bool {
  role.is_some_and(|role| CONTROLS.contains(&role))
}

#[cfg(any(target_os = "linux", test))]
pub fn is_dropdown_part(role: Option<&str>) -> bool {
  matches!(role, Some("menuitem" | "listitem" | "menu" | "list"))
}

#[cfg(any(target_os = "linux", test))]
pub fn is_option(role: Option<&str>) -> bool {
  matches!(role, Some("menuitem" | "listitem"))
}

#[cfg(any(target_os = "linux", test))]
pub fn in_row((_, top, _, bottom): Bounds, (left, _, right, _): Bounds, x: i32, y: i32) -> bool {
  (top..bottom).contains(&y) && (left..right).contains(&x)
}

#[cfg(any(target_os = "linux", test))]
pub fn dropdown_takes(expanded: Option<bool>, on_dropdown: bool, on_option: bool) -> bool {
  match expanded {
    Some(false) => true,
    Some(true) => on_dropdown && !on_option,
    None => false,
  }
}

#[cfg(test)]
mod tests {
  use super::{dropdown_takes, in_row, is_control, is_dropdown_part, is_label, is_option, smallest_under};

  const PANEL: (i32, i32, i32, i32) = (0, 0, 400, 600);
  const ITEM: (i32, i32, i32, i32) = (10, 50, 390, 90);
  const ICON: (i32, i32, i32, i32) = (12, 55, 40, 85);

  #[test]
  fn takes_the_smallest_box_under_the_point() {
    assert_eq!(smallest_under(&[PANEL, ITEM, ICON], 100, 70), Some(1));
    assert_eq!(smallest_under(&[PANEL, ITEM, ICON], 20, 70), Some(2));
  }

  #[test]
  fn ignores_empty_boxes_and_boxes_elsewhere() {
    assert_eq!(
      smallest_under(&[PANEL, (100, 70, 100, 70), (0, 0, 0, 0)], 100, 70),
      Some(0)
    );
    assert_eq!(smallest_under(&[PANEL, ITEM], 100, 700), None);
    assert_eq!(smallest_under(&[ITEM], 390, 70), None);
  }

  #[test]
  fn keeps_the_outer_element_when_sizes_tie() {
    assert_eq!(smallest_under(&[ITEM, ITEM], 100, 70), Some(0));
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

  const LIST: (i32, i32, i32, i32) = (100, 200, 500, 400);
  const OPTION: (i32, i32, i32, i32) = (102, 220, 300, 240);

  #[test]
  fn an_option_row_spans_its_list() {
    assert!(in_row(OPTION, LIST, 450, 230));
    assert!(in_row(OPTION, LIST, 102, 220));
    assert!(!in_row(OPTION, LIST, 500, 230));
    assert!(!in_row(OPTION, LIST, 450, 240));
    assert!(!in_row(OPTION, LIST, 50, 230));
  }

  #[test]
  fn a_closed_dropdown_takes_its_hidden_options() {
    assert!(dropdown_takes(Some(false), false, false));
    assert!(dropdown_takes(Some(false), true, true));
  }

  #[test]
  fn an_open_dropdown_takes_only_its_button() {
    assert!(dropdown_takes(Some(true), true, false));
    assert!(!dropdown_takes(Some(true), true, true));
    assert!(!dropdown_takes(Some(true), false, false));
  }

  #[test]
  fn an_unknown_dropdown_state_keeps_the_hit() {
    assert!(!dropdown_takes(None, true, false));
    assert!(!dropdown_takes(None, false, true));
  }

  #[test]
  fn only_list_parts_belong_to_a_dropdown() {
    assert!(is_dropdown_part(Some("menuitem")));
    assert!(is_dropdown_part(Some("listitem")));
    assert!(is_dropdown_part(Some("menu")));
    assert!(!is_dropdown_part(Some("textbox")));
    assert!(!is_dropdown_part(None));
    assert!(is_option(Some("listitem")));
    assert!(!is_option(Some("menu")));
  }
}
