const SYSTEM_POPUP_CLASSES: &[&str] = &["#32768", "#32770", "ComboLBox", "tooltips_class32"];
const EDGE_SLACK: i32 = 4;

pub struct Traits<'a> {
  pub class: &'a str,
  pub owned: bool,
  pub no_activate: bool,
  pub tool_window: bool,
  pub captionless_popup: bool,
}

#[derive(Clone, Copy)]
pub struct Edges {
  pub left: i32,
  pub top: i32,
  pub right: i32,
  pub bottom: i32,
}

pub fn is_popup(traits: &Traits) -> bool {
  let styled = traits.owned || traits.no_activate || traits.tool_window || traits.captionless_popup;
  styled || SYSTEM_POPUP_CLASSES.contains(&traits.class)
}

pub fn names_its_surface(name: &str, class: &str, container: bool, hidden_caption: Option<&str>) -> bool {
  name == class || (container && hidden_caption == Some(name))
}

pub fn fills(window: Edges, work_area: Edges) -> bool {
  window.left <= work_area.left + EDGE_SLACK
    && window.top <= work_area.top + EDGE_SLACK
    && window.right >= work_area.right - EDGE_SLACK
    && window.bottom >= work_area.bottom - EDGE_SLACK
}

#[cfg(test)]
mod tests {
  use super::{fills, is_popup, names_its_surface, Edges, Traits};

  fn plain(class: &str) -> Traits<'_> {
    Traits {
      class,
      owned: false,
      no_activate: false,
      tool_window: false,
      captionless_popup: false,
    }
  }

  fn edges(left: i32, top: i32, right: i32, bottom: i32) -> Edges {
    Edges {
      left,
      top,
      right,
      bottom,
    }
  }

  #[test]
  fn system_menus_dialogs_lists_and_tooltips_are_popups() {
    for class in ["#32768", "#32770", "ComboLBox", "tooltips_class32"] {
      assert!(is_popup(&plain(class)), "{class}");
    }
  }

  #[test]
  fn a_class_name_alone_never_makes_an_unstyled_window_a_popup() {
    for class in [
      "Chrome_WidgetWin_1",
      "CabinetWClass",
      "Net UI Popup",
      "SomeDropDownHost",
    ] {
      assert!(!is_popup(&plain(class)), "{class}");
    }
  }

  #[test]
  fn owned_tool_no_activate_and_captionless_windows_are_popups() {
    let base = || plain("Chrome_WidgetWin_1");
    assert!(is_popup(&Traits {
      owned: true,
      ..base()
    }));
    assert!(is_popup(&Traits {
      tool_window: true,
      ..base()
    }));
    assert!(is_popup(&Traits {
      no_activate: true,
      ..base()
    }));
    assert!(is_popup(&Traits {
      captionless_popup: true,
      ..base()
    }));
  }

  #[test]
  fn a_window_fills_its_monitor_only_when_it_reaches_every_edge_of_the_work_area() {
    let work = edges(0, 0, 1920, 1040);
    assert!(fills(edges(0, 0, 1920, 1040), work));
    assert!(fills(edges(-8, -8, 1928, 1048), work));
    assert!(fills(edges(2, 1, 1918, 1038), work));
    assert!(!fills(edges(0, 0, 1700, 1040), work));
    assert!(!fills(edges(400, 300, 800, 600), work));
  }

  #[test]
  fn filling_is_judged_against_the_monitor_the_window_is_on() {
    let second = edges(1920, 0, 3840, 1040);
    assert!(fills(edges(1920, 0, 3840, 1040), second));
    assert!(!fills(edges(0, 0, 1920, 1040), second));
  }

  #[test]
  fn a_container_named_after_its_hidden_child_window_caption_has_no_name() {
    assert!(names_its_surface(
      "Chrome Legacy Window",
      "Chrome_RenderWidgetHostHWND",
      true,
      Some("Chrome Legacy Window")
    ));
    assert!(names_its_surface(
      "Intermediate D3D Window",
      "Intermediate D3D Window",
      true,
      None
    ));
    assert!(names_its_surface(
      "Chrome_WidgetWin_1",
      "Chrome_WidgetWin_1",
      false,
      None
    ));
  }

  #[test]
  fn controls_and_visible_window_titles_keep_their_names() {
    assert!(!names_its_surface("OK", "Button", false, Some("OK")));
    assert!(!names_its_surface(
      "Hello world.txt - Notepad",
      "Notepad",
      true,
      None
    ));
    assert!(!names_its_surface("Search", "", true, Some("Search box")));
  }
}
