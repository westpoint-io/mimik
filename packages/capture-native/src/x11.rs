use x11rb::protocol::xproto::{ChangeWindowAttributesAux, ConnectionExt, InputFocus, MapState};
use x11rb::rust_connection::RustConnection;
use x11rb::CURRENT_TIME;

fn connect() -> Option<RustConnection> {
  RustConnection::connect(None).ok().map(|(conn, _)| conn)
}

pub fn float_above_shell(window: u32) {
  let Some(conn) = connect() else { return };
  let aux = ChangeWindowAttributesAux::new().override_redirect(1);
  if let Ok(cookie) = conn.change_window_attributes(window, &aux) {
    let _ = cookie.check();
  };
}

pub fn focus_window(window: u32) {
  let Some(conn) = connect() else { return };
  let viewable = conn
    .get_window_attributes(window)
    .ok()
    .and_then(|cookie| cookie.reply().ok())
    .is_some_and(|attrs| attrs.map_state == MapState::VIEWABLE);
  if !viewable {
    return;
  }
  if let Ok(cookie) = conn.set_input_focus(InputFocus::PARENT, window, CURRENT_TIME) {
    let _ = cookie.check();
  };
}
