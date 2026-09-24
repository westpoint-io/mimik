const POPUP_CLASSES: &[&str] = &["#32768", "#32770", "Auto-Suggest Dropdown", "tooltips_class32"];
const POPUP_FRAGMENTS: &[&str] = &["Popup", "DropDown", "ComboLBox"];
const MOST_OF_THE_SCREEN: f64 = 0.8;

pub struct Traits<'a> {
  pub class: &'a str,
  pub owned: bool,
  pub no_activate: bool,
  pub tool_window: bool,
  pub captionless_popup: bool,
}

pub fn is_popup(traits: &Traits) -> bool {
  POPUP_CLASSES.contains(&traits.class)
    || POPUP_FRAGMENTS
      .iter()
      .any(|fragment| traits.class.contains(fragment))
    || traits.owned
    || traits.no_activate
    || traits.tool_window
    || traits.captionless_popup
}

pub fn covers_most_of_the_screen(window: f64, largest_monitor: f64, desktop: f64) -> bool {
  window > largest_monitor * MOST_OF_THE_SCREEN || window > desktop * MOST_OF_THE_SCREEN
}

#[cfg(test)]
mod tests {
  use super::{covers_most_of_the_screen, is_popup, Traits};

  fn plain(class: &str) -> Traits<'_> {
    Traits {
      class,
      owned: false,
      no_activate: false,
      tool_window: false,
      captionless_popup: false,
    }
  }

  #[test]
  fn menus_dropdowns_and_dialogs_are_popups() {
    for class in [
      "#32768",
      "#32770",
      "Auto-Suggest Dropdown",
      "tooltips_class32",
      "Net UI Popup",
      "ComboLBox",
    ] {
      assert!(is_popup(&plain(class)), "{class}");
    }
  }

  #[test]
  fn an_ordinary_top_level_window_is_not_a_popup() {
    assert!(!is_popup(&plain("Chrome_WidgetWin_1")));
    assert!(!is_popup(&plain("CabinetWClass")));
  }

  #[test]
  fn owned_tool_and_captionless_windows_are_popups() {
    assert!(is_popup(&Traits {
      owned: true,
      ..plain("Chrome_WidgetWin_1")
    }));
    assert!(is_popup(&Traits {
      tool_window: true,
      ..plain("Chrome_WidgetWin_1")
    }));
    assert!(is_popup(&Traits {
      no_activate: true,
      ..plain("Chrome_WidgetWin_1")
    }));
    assert!(is_popup(&Traits {
      captionless_popup: true,
      ..plain("Chrome_WidgetWin_1")
    }));
  }

  #[test]
  fn most_of_the_screen_is_measured_by_area() {
    let monitor = 1920.0 * 1080.0;
    assert!(covers_most_of_the_screen(1900.0 * 1000.0, monitor, monitor));
    assert!(!covers_most_of_the_screen(400.0 * 300.0, monitor, monitor));
    assert!(covers_most_of_the_screen(1800.0 * 1000.0, monitor, monitor * 2.0));
    assert!(covers_most_of_the_screen(10.0, 0.0, 0.0));
  }
}
