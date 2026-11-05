const ROLES: &[(u32, &str)] = &[
  (7, "checkbox"),
  (8, "menuitem"),
  (10, "columnheader"),
  (11, "combobox"),
  (16, "window"),
  (23, "window"),
  (26, "img"),
  (27, "img"),
  (29, "text"),
  (31, "list"),
  (32, "listitem"),
  (33, "menu"),
  (34, "menubar"),
  (35, "menuitem"),
  (37, "tab"),
  (38, "tablist"),
  (39, "group"),
  (40, "textbox"),
  (41, "menu"),
  (42, "progressbar"),
  (43, "button"),
  (44, "radio"),
  (45, "menuitem"),
  (48, "scrollbar"),
  (49, "pane"),
  (50, "separator"),
  (51, "slider"),
  (52, "spinbutton"),
  (54, "status"),
  (55, "table"),
  (56, "cell"),
  (57, "columnheader"),
  (59, "menuitem"),
  (60, "textbox"),
  (61, "textbox"),
  (62, "button"),
  (63, "toolbar"),
  (64, "tooltip"),
  (65, "tree"),
  (66, "tree"),
  (69, "window"),
  (73, "text"),
  (76, "combobox"),
  (79, "textbox"),
  (82, "document"),
  (83, "heading"),
  (85, "group"),
  (88, "link"),
  (90, "row"),
  (91, "treeitem"),
  (95, "document"),
  (98, "list"),
  (99, "group"),
  (116, "text"),
  (129, "button"),
  (130, "switch"),
];

pub const PASSWORD_TEXT: u32 = 40;
pub const STATE_ACTIVE: u32 = 1;
pub const STATE_FOCUSED: u32 = 12;
pub const STATE_SELECTED: u32 = 23;
pub const STATE_SHOWING: u32 = 25;

pub fn control_roles() -> Vec<i32> {
  ROLES
    .iter()
    .filter(|(_, name)| {
      matches!(*name, "listitem" | "spinbutton" | "slider" | "textbox" | "menu")
        || crate::hit::is_control(Some(name))
    })
    .map(|(found, _)| *found as i32)
    .collect()
}

pub fn role(atspi: u32) -> Option<String> {
  ROLES
    .iter()
    .find(|(found, _)| *found == atspi)
    .map(|(_, name)| (*name).to_string())
}

pub fn has_state(states: &[u32], state: u32) -> bool {
  states
    .get((state / 32) as usize)
    .is_some_and(|word| word & (1 << (state % 32)) != 0)
}

fn role_mask(roles: impl Iterator<Item = i32>) -> Vec<i32> {
  let mut words = vec![0i32; 4];
  for role in roles.filter(|role| *role < 128) {
    words[(role / 32) as usize] |= (1u32 << (role % 32)) as i32;
  }
  words
}

pub fn control_role_mask() -> Vec<i32> {
  role_mask(control_roles().into_iter())
}

pub fn menu_item_mask() -> Vec<i32> {
  role_mask(
    ROLES
      .iter()
      .filter(|(_, name)| *name == "menuitem")
      .map(|(found, _)| *found as i32),
  )
}

pub fn state_set(state: u32) -> Vec<i32> {
  let mut words = vec![0i32; 2];
  words[(state / 32) as usize] |= (1u32 << (state % 32)) as i32;
  words
}

#[cfg(test)]
mod tests {
  use super::{control_role_mask, has_state, role, state_set, STATE_FOCUSED, STATE_SHOWING};

  #[test]
  fn control_roles_are_packed_as_bitmask_words() {
    let words = control_role_mask();
    assert_eq!(words.len(), 4);
    assert_ne!(words[1] & (1 << (43 - 32)), 0);
    assert_eq!(words[0] & (1 << 26), 0);
  }

  #[test]
  fn atspi_roles_use_the_shared_names() {
    assert_eq!(role(43).as_deref(), Some("button"));
    assert_eq!(role(79).as_deref(), Some("textbox"));
    assert_eq!(role(40).as_deref(), Some("textbox"));
    assert_eq!(role(29).as_deref(), Some("text"));
    assert_eq!(role(20), None);
  }

  #[test]
  fn states_are_read_from_two_words() {
    let states = [1 << STATE_FOCUSED | 1 << STATE_SHOWING, 0];
    assert!(has_state(&states, STATE_FOCUSED));
    assert!(!has_state(&states, 33));
    assert!(has_state(&[0, 1 << 1], 33));
    assert!(!has_state(&[], STATE_FOCUSED));
    assert_eq!(state_set(STATE_FOCUSED), vec![1 << 12, 0]);
  }
}
