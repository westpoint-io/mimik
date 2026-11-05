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

pub fn named_key(keycode: u32) -> Option<String> {
  if let Some((_, name)) = NAMED_KEYS.iter().find(|(vc, _)| *vc == keycode) {
    return Some((*name).to_string());
  }
  FUNCTION_KEYS
    .iter()
    .find(|(vc, _)| *vc == keycode)
    .map(|(_, number)| format!("F{number}"))
}

pub fn printable(text: &str) -> Option<String> {
  (!text.is_empty() && text.chars().all(|found| !found.is_control())).then(|| text.to_string())
}

#[cfg(test)]
mod tests {
  use super::{named_key, printable};

  #[test]
  fn named_and_function_keys_skip_the_layout() {
    assert_eq!(named_key(0x1c).as_deref(), Some("Enter"));
    assert_eq!(named_key(0xe04b).as_deref(), Some("ArrowLeft"));
    assert_eq!(named_key(0x58).as_deref(), Some("F12"));
    assert_eq!(named_key(0x1e), None);
  }

  #[test]
  fn control_characters_are_not_typing() {
    assert_eq!(printable("é").as_deref(), Some("é"));
    assert_eq!(printable("\u{13}"), None);
    assert_eq!(printable(""), None);
  }
}
