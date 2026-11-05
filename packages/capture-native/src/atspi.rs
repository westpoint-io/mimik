use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;
use x11rb::connection::Connection as _;
use x11rb::protocol::res::{ClientIdMask, ClientIdSpec, ConnectionExt as _};
use x11rb::protocol::xproto::{AtomEnum, ConnectionExt as _, MapState, Window};
use x11rb::rust_connection::RustConnection;
use zbus::blocking::Connection;
use zbus::zvariant::{DynamicType, OwnedObjectPath, OwnedValue, Value};

use crate::atspimap::{
  control_role_mask, control_roles, has_state, menu_item_mask, role, state_set, PASSWORD_TEXT, STATE_ACTIVE,
  STATE_FOCUSED, STATE_SELECTED, STATE_SHOWING,
};
use crate::hit::{is_control, is_label, smallest_under, Bounds, PROMOTE_DEPTH};
use crate::{ElementNode, ElementRect, UiElement};

const ACCESSIBLE: &str = "org.a11y.atspi.Accessible";
const COMPONENT: &str = "org.a11y.atspi.Component";
const TEXT: &str = "org.a11y.atspi.Text";
const COLLECTION: &str = "org.a11y.atspi.Collection";
const PROPERTIES: &str = "org.freedesktop.DBus.Properties";
const REGISTRY: &str = "org.a11y.atspi.Registry";
const ROOT: &str = "/org/a11y/atspi/accessible/root";
const NULL_PATH: &str = "/org/a11y/atspi/null";
const APPLICATION: &str = "org.a11y.atspi.Application";
const SCREEN: u32 = 0;
const WINDOW: u32 = 1;
const GTK4: &str = "GTK";
const CALL_TIMEOUT: Duration = Duration::from_millis(300);
const MAX_DEPTH: usize = 40;
const MAX_ANCESTORS: usize = 4;
const MAX_CHILDREN: usize = 12;
const MAX_VALUE: i32 = 2000;
const FOCUS_SEARCH_LIMIT: usize = 600;
const MATCH_ALL: i32 = 1;
const MATCH_ANY: i32 = 2;
const CONTROL_SCAN_LIMIT: i32 = 400;
const WALK_LIMIT: usize = 500;
const CLIMB_LIMIT: usize = 4;
const POPUP_CLIMB: usize = 24;
const MATCH_NONE: i32 = 3;
const LABELLED_BY: u32 = 2;
const SORT_CANONICAL: u32 = 1;
const FOCUS_EVENT: &str = "object:state-changed:focused";
const SHELL: &str = "gnome-shell";
const SHELL_BUS: &str = "org.gnome.Shell";
const SHELL_PATH: &str = "/org/gnome/Shell";
const CONTENT_LIMIT: usize = 40;
const WINDOW_LIMIT: usize = 8;
const WAKE_WAIT: Duration = Duration::from_millis(2500);
const WAKE_POLL: Duration = Duration::from_millis(100);
const SHELL_SEARCH_LIMIT: usize = 400;
const OVERLAY_LIMIT: usize = 12;
const SCAN_LIMIT: usize = 120;

type Reference = (String, OwnedObjectPath);

struct Session {
  bus: Connection,
  desktop: Connection,
  listener: Option<Connection>,
  apps: HashMap<u32, Reference>,
  shell: Option<Reference>,
}

static SESSION: Mutex<Option<Session>> = Mutex::new(None);
static FOCUSED: Mutex<Option<Reference>> = Mutex::new(None);

type EventBody = (String, i32, i32, OwnedValue, HashMap<String, OwnedValue>);

#[derive(Clone)]
struct Node {
  bus: Connection,
  name: String,
  path: OwnedObjectPath,
  offset: (i32, i32),
  coords: u32,
}

impl Node {
  fn new(bus: &Connection, (name, path): Reference) -> Option<Node> {
    (path.as_str() != NULL_PATH && !name.is_empty()).then(|| Node {
      bus: bus.clone(),
      name,
      path,
      offset: (0, 0),
      coords: SCREEN,
    })
  }

  fn related(&self, reference: Reference) -> Option<Node> {
    Node::new(&self.bus, reference).map(|found| found.placed(self.offset, self.coords))
  }

  fn placed(mut self, offset: (i32, i32), coords: u32) -> Node {
    self.offset = offset;
    self.coords = coords;
    self
  }

  fn call<B, R>(&self, interface: &str, method: &str, body: &B) -> Option<R>
  where
    B: Serialize + DynamicType,
    R: DeserializeOwned + zbus::zvariant::Type,
  {
    self
      .bus
      .call_method(
        Some(self.name.as_str()),
        self.path.as_str(),
        Some(interface),
        method,
        body,
      )
      .ok()?
      .body()
      .deserialize()
      .ok()
  }

  fn property<R: TryFrom<OwnedValue>>(&self, interface: &str, name: &str) -> Option<R> {
    let value: OwnedValue = self.call(PROPERTIES, "Get", &(interface, name))?;
    R::try_from(value).ok()
  }

  fn text_property(&self, name: &str) -> Option<String> {
    self
      .property::<String>(ACCESSIBLE, name)
      .map(|found| found.trim().to_string())
      .filter(|found| !found.is_empty())
  }

  fn same(&self, other: &Node) -> bool {
    self.name == other.name && self.path == other.path
  }

  fn role(&self) -> Option<u32> {
    self.call(ACCESSIBLE, "GetRole", &())
  }

  fn states(&self) -> Vec<u32> {
    self.call(ACCESSIBLE, "GetState", &()).unwrap_or_default()
  }

  fn parent(&self) -> Option<Node> {
    let parent: Reference = self.property(ACCESSIBLE, "Parent")?;
    self.related(parent).filter(|found| found.path.as_str() != ROOT)
  }

  fn children(&self) -> Vec<Node> {
    let found: Vec<Reference> = self.call(ACCESSIBLE, "GetChildren", &()).unwrap_or_default();
    found
      .into_iter()
      .filter_map(|child| self.related(child))
      .collect()
  }

  fn extents(&self) -> Option<ElementRect> {
    let (x, y, width, height): (i32, i32, i32, i32) = self.call(COMPONENT, "GetExtents", &(self.coords,))?;
    (width > 0 && height > 0).then_some(ElementRect {
      x: f64::from(x + self.offset.0),
      y: f64::from(y + self.offset.1),
      width: f64::from(width),
      height: f64::from(height),
    })
  }

  fn child_at(&self, x: i32, y: i32) -> Option<Node> {
    let (local_x, local_y) = (x - self.offset.0, y - self.offset.1);
    let found: Reference = self.call(
      COMPONENT,
      "GetAccessibleAtPoint",
      &(local_x, local_y, self.coords),
    )?;
    self.related(found).filter(|found| !found.same(self))
  }

  fn attributes(&self) -> HashMap<String, String> {
    self.call(ACCESSIBLE, "GetAttributes", &()).unwrap_or_default()
  }

  fn character_count(&self) -> Option<u32> {
    self
      .property::<i32>(TEXT, "CharacterCount")
      .map(|count| count.max(0) as u32)
  }

  fn text(&self) -> Option<String> {
    let count = self.property::<i32>(TEXT, "CharacterCount")?.min(MAX_VALUE);
    let found: String = self.call(TEXT, "GetText", &(0i32, count))?;
    Some(found).filter(|found| !found.is_empty())
  }
}

fn connect() -> Option<Connection> {
  let session = Connection::session().ok()?;
  let address: String = session
    .call_method(
      Some("org.a11y.Bus"),
      "/org/a11y/bus",
      Some("org.a11y.Bus"),
      "GetAddress",
      &(),
    )
    .ok()?
    .body()
    .deserialize()
    .ok()?;
  zbus::blocking::connection::Builder::address(address.as_str())
    .ok()?
    .method_timeout(CALL_TIMEOUT)
    .build()
    .ok()
}

pub fn enable() {
  with_session(|_| Some(()));
  let Ok(session) = Connection::session() else {
    return;
  };
  let _ = session.call_method(
    Some("org.a11y.Bus"),
    "/org/a11y/bus",
    Some(PROPERTIES),
    "Set",
    &("org.a11y.Status", "IsEnabled", Value::from(true)),
  );
}

fn wake(app: &Node) {
  let _: Option<HashMap<String, String>> = app.call(ACCESSIBLE, "GetAttributes", &());
}

fn wake_sleeping(session: &Session) {
  for app in apps(session) {
    if !has_window(&app) {
      wake(&app);
    }
  }
}

fn with_session<T>(work: impl FnOnce(&mut Session) -> Option<T>) -> Option<T> {
  let mut slot = SESSION.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  if slot.is_none() {
    *slot = Some(Session {
      bus: connect()?,
      desktop: zbus::blocking::connection::Builder::session()
        .ok()?
        .method_timeout(CALL_TIMEOUT)
        .build()
        .ok()?,
      listener: listen(),
      apps: HashMap::new(),
      shell: None,
    });
    if let Some(session) = slot.as_ref() {
      wake_sleeping(session);
    }
  }
  work(slot.as_mut()?)
}

pub fn release() {
  let Some(session) = SESSION
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner())
    .take()
  else {
    return;
  };
  if let Some(listener) = session.listener {
    let _ = registry(&listener, "DeregisterEvent", &(FOCUS_EVENT,));
    let _ = listener.close();
  }
  FOCUSED
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner())
    .take();
}

fn registry<B: Serialize + DynamicType>(bus: &Connection, method: &str, body: &B) -> zbus::Result<()> {
  bus
    .call_method(
      Some(REGISTRY),
      "/org/a11y/atspi/registry",
      Some(REGISTRY),
      method,
      body,
    )
    .map(|_| ())
}

fn listen() -> Option<Connection> {
  let bus = connect()?;
  let empty: Vec<String> = Vec::new();
  registry(&bus, "RegisterEvent", &(FOCUS_EVENT, empty, ""))
    .or_else(|_| registry(&bus, "RegisterEvent", &(FOCUS_EVENT,)))
    .ok()?;
  let rule = zbus::MatchRule::builder()
    .msg_type(zbus::message::Type::Signal)
    .interface("org.a11y.atspi.Event.Object")
    .ok()?
    .member("StateChanged")
    .ok()?
    .build();
  let messages = zbus::blocking::MessageIterator::for_match_rule(rule, &bus, None).ok()?;
  std::thread::spawn(move || {
    for message in messages.flatten() {
      let header = message.header();
      let (Some(sender), Some(path)) = (header.sender(), header.path()) else {
        continue;
      };
      let Ok((kind, gained, ..)) = message.body().deserialize::<EventBody>() else {
        continue;
      };
      if kind == "focused" && gained == 1 {
        let reference = (sender.to_string(), OwnedObjectPath::from(path.to_owned()));
        *FOCUSED.lock().unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(reference);
      }
    }
  });
  Some(bus)
}

fn apps(session: &Session) -> Vec<Node> {
  let Ok(path) = OwnedObjectPath::try_from(ROOT) else {
    return Vec::new();
  };
  Node::new(&session.bus, (REGISTRY.to_string(), path))
    .map(|root| root.children())
    .unwrap_or_default()
}

fn owner_of(session: &Session, app: &Node) -> Option<u32> {
  session
    .bus
    .call_method(
      Some("org.freedesktop.DBus"),
      "/org/freedesktop/DBus",
      Some("org.freedesktop.DBus"),
      "GetConnectionUnixProcessID",
      &(app.name.as_str(),),
    )
    .ok()
    .and_then(|reply| reply.body().deserialize().ok())
}

fn sandbox_of(pid: u32) -> Option<String> {
  let cgroup = std::fs::read_to_string(format!("/proc/{pid}/cgroup")).ok()?;
  let scope = cgroup
    .lines()
    .find_map(|line| line.strip_prefix("0::"))?
    .rsplit('/')
    .next()?;
  scope.starts_with("app-flatpak-").then(|| scope.to_string())
}

fn has_window(app: &Node) -> bool {
  app
    .children()
    .iter()
    .any(|window| has_state(&window.states(), STATE_SHOWING))
}

fn app_for(session: &mut Session, pid: u32) -> Option<Node> {
  if let Some(found) = session.apps.get(&pid) {
    return Node::new(&session.bus, found.clone());
  }
  let all = apps(session);
  let mut owned: Vec<Node> = all
    .iter()
    .filter(|app| owner_of(session, app) == Some(pid))
    .cloned()
    .collect();
  if owned.is_empty() {
    if let Some(sandbox) = sandbox_of(pid) {
      owned = all
        .into_iter()
        .filter(|app| owner_of(session, app).and_then(sandbox_of).as_deref() == Some(sandbox.as_str()))
        .collect();
    }
  }
  let chosen = match owned.len() {
    0 => return None,
    1 => owned.into_iter().next()?,
    _ => owned
      .iter()
      .find(|app| has_window(app))
      .cloned()
      .or_else(|| owned.into_iter().next())?,
  };
  if !has_window(&chosen) {
    wake(&chosen);
    let deadline = std::time::Instant::now() + WAKE_WAIT;
    while !has_window(&chosen) && std::time::Instant::now() < deadline {
      std::thread::sleep(WAKE_POLL);
    }
  }
  session
    .apps
    .insert(pid, (chosen.name.clone(), chosen.path.clone()));
  Some(chosen)
}

fn property32(conn: &RustConnection, window: Window, name: &[u8], kind: AtomEnum) -> Option<Vec<u32>> {
  let atom = conn.intern_atom(true, name).ok()?.reply().ok()?.atom;
  let reply = conn
    .get_property(false, window, atom, kind, 0, 4096)
    .ok()?
    .reply()
    .ok()?;
  reply.value32().map(|values| values.collect())
}

fn contains(conn: &RustConnection, root: Window, window: Window, x: i32, y: i32) -> bool {
  let viewable = conn
    .get_window_attributes(window)
    .ok()
    .and_then(|cookie| cookie.reply().ok())
    .is_some_and(|attrs| attrs.map_state == MapState::VIEWABLE);
  let Some(geometry) = conn
    .get_geometry(window)
    .ok()
    .and_then(|cookie| cookie.reply().ok())
  else {
    return false;
  };
  let Some(origin) = conn
    .translate_coordinates(window, root, 0, 0)
    .ok()
    .and_then(|cookie| cookie.reply().ok())
  else {
    return false;
  };
  let (left, top) = (i32::from(origin.dst_x), i32::from(origin.dst_y));
  viewable
    && (left..left + i32::from(geometry.width)).contains(&x)
    && (top..top + i32::from(geometry.height)).contains(&y)
}

fn client_pid(conn: &RustConnection, window: Window) -> Option<u32> {
  let spec = ClientIdSpec {
    client: window,
    mask: ClientIdMask::LOCAL_CLIENT_PID,
  };
  let reply = conn.res_query_client_ids(&[spec]).ok()?.reply().ok()?;
  reply
    .ids
    .iter()
    .find(|id| id.spec.mask == ClientIdMask::LOCAL_CLIENT_PID)
    .and_then(|id| id.value.first().copied())
}

struct Target {
  pid: u32,
  origin: (i32, i32),
  frame: (i32, i32),
  title: Option<String>,
  popup: Option<(i32, i32)>,
}

fn target(conn: &RustConnection, root: Window, window: Window) -> Option<Target> {
  let pid = property32(conn, window, b"_NET_WM_PID", AtomEnum::CARDINAL)
    .and_then(|values| values.first().copied())
    .or_else(|| client_pid(conn, window))?;
  let origin = conn
    .translate_coordinates(window, root, 0, 0)
    .ok()?
    .reply()
    .ok()?;
  let atom = conn.intern_atom(true, b"_NET_WM_NAME").ok()?.reply().ok()?.atom;
  let title = conn
    .get_property(false, window, atom, AtomEnum::ANY, 0, 1024)
    .ok()
    .and_then(|cookie| cookie.reply().ok())
    .and_then(|reply| String::from_utf8(reply.value).ok())
    .filter(|found| !found.is_empty());
  let frame = match property32(conn, window, b"_GTK_FRAME_EXTENTS", AtomEnum::CARDINAL).as_deref() {
    Some([left, top, ..]) => (*left as i32, *top as i32),
    _ => (0, 0),
  };
  Some(Target {
    pid,
    origin: (i32::from(origin.dst_x), i32::from(origin.dst_y)),
    frame,
    title,
    popup: None,
  })
}

fn popup_at(conn: &RustConnection, root: Window, x: i32, y: i32) -> Option<Target> {
  let tree = conn.query_tree(root).ok()?.reply().ok()?;
  for window in tree.children.into_iter().rev() {
    if !contains(conn, root, window, x, y) {
      continue;
    }
    let attributes = conn.get_window_attributes(window).ok()?.reply().ok()?;
    if !attributes.override_redirect {
      return None;
    }
    let kinds = property32(conn, window, b"_NET_WM_WINDOW_TYPE", AtomEnum::ATOM).unwrap_or_default();
    let menu = kinds.iter().any(|atom| {
      conn
        .get_atom_name(*atom)
        .ok()
        .and_then(|cookie| cookie.reply().ok())
        .is_some_and(|reply| {
          let name = String::from_utf8_lossy(&reply.name);
          name.contains("MENU") || name.contains("COMBO")
        })
    });
    if !menu {
      continue;
    }
    let geometry = conn.get_geometry(window).ok()?.reply().ok()?;
    let mut found = target(conn, root, window)?;
    if found.pid == std::process::id() {
      continue;
    }
    found.popup = Some((i32::from(geometry.width), i32::from(geometry.height)));
    return Some(found);
  }
  None
}

fn popup_root(session: &mut Session, target: &Target) -> Option<Node> {
  let size = target.popup?;
  let app = app_for(session, target.pid)?;
  let heard = FOCUSED
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner())
    .clone()
    .filter(|(name, _)| *name == app.name)?;
  let mut current = Node::new(&session.bus, heard)?;
  for _ in 0..POPUP_CLIMB {
    let local = current.clone().placed((0, 0), WINDOW).extents();
    if local
      .as_ref()
      .is_some_and(|rect| (rect.width as i32, rect.height as i32) == size)
    {
      let (origin, coords) = placement(&app, Some(&current), target);
      if coords == SCREEN {
        return Some(current.placed(origin, coords));
      }
      let rect = local?;
      let offset = (target.origin.0 - rect.x as i32, target.origin.1 - rect.y as i32);
      return Some(current.placed(offset, WINDOW));
    }
    current = current.parent()?;
  }
  None
}

fn x_root() -> Option<(RustConnection, Window)> {
  let (conn, screen) = RustConnection::connect(None).ok()?;
  let root = conn.setup().roots.get(screen)?.root;
  Some((conn, root))
}

fn in_work_area(conn: &RustConnection, root: Window, x: i32, y: i32) -> bool {
  let area = property32(conn, root, b"_NET_WORKAREA", AtomEnum::CARDINAL).unwrap_or_default();
  let [left, top, width, height, ..] = area[..] else {
    return true;
  };
  let (left, top) = (left as i32, top as i32);
  (left..left + width as i32).contains(&x) && (top..top + height as i32).contains(&y)
}

fn target_at(conn: &RustConnection, root: Window, x: i32, y: i32) -> Option<Target> {
  let stacking = property32(conn, root, b"_NET_CLIENT_LIST_STACKING", AtomEnum::WINDOW)?;
  let window = stacking.iter().rev().find_map(|window| {
    if contains(conn, root, *window, x, y) {
      Some(*window)
    } else {
      frame_around(conn, root, *window, x, y)
    }
  })?;
  target(conn, root, window)
}

fn frame_around(conn: &RustConnection, root: Window, window: Window, x: i32, y: i32) -> Option<Window> {
  let extents = property32(conn, window, b"_NET_FRAME_EXTENTS", AtomEnum::CARDINAL)?;
  if extents.iter().all(|side| *side == 0) {
    return None;
  }
  let parent = conn.query_tree(window).ok()?.reply().ok()?.parent;
  (parent != root && contains(conn, root, parent, x, y)).then_some(parent)
}

fn active_target() -> Option<Target> {
  let (conn, root) = x_root()?;
  let active = *property32(&conn, root, b"_NET_ACTIVE_WINDOW", AtomEnum::WINDOW)?.first()?;
  target(&conn, root, active)
}

fn shell_window(session: &mut Session) -> Option<Node> {
  if session.shell.is_none() {
    let found = apps(session)
      .into_iter()
      .find(|app| app.text_property("Name").as_deref() == Some(SHELL))?;
    session.shell = Some((found.name, found.path));
  }
  let shell = Node::new(&session.bus, session.shell.clone()?)?;
  shell
    .children()
    .into_iter()
    .find(|window| has_state(&window.states(), STATE_SHOWING))
}

fn covers(rect: &ElementRect, x: i32, y: i32) -> bool {
  let (x, y) = (f64::from(x), f64::from(y));
  x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height
}

fn shell_hit(window: Node, x: i32, y: i32) -> Node {
  let mut budget = SHELL_SEARCH_LIMIT;
  let mut controls = control_roles();
  controls.retain(|found| role(*found as u32).as_deref() != Some("textbox"));
  let mut deepest = (0, window.clone());
  let mut named: Option<(usize, Node)> = None;
  let mut control: Option<(usize, Node)> = None;
  let mut stack = vec![(0, window)];
  while let Some((depth, node)) = stack.pop() {
    if budget == 0 {
      break;
    }
    budget -= 1;
    if depth >= deepest.0 {
      deepest = (depth, node.clone());
    }
    if node.role().is_some_and(|role| controls.contains(&(role as i32)))
      && control.as_ref().is_none_or(|(best, _)| depth >= *best)
    {
      control = Some((depth, node.clone()));
    }
    if node.text_property("Name").is_some() && named.as_ref().is_none_or(|(best, _)| depth >= *best) {
      named = Some((depth, node.clone()));
    }
    for child in node.children() {
      if child.extents().is_some_and(|rect| covers(&rect, x, y)) && has_state(&child.states(), STATE_SHOWING)
      {
        stack.push((depth + 1, child));
      }
    }
  }
  control.or(named).unwrap_or(deepest).1
}

fn shell_overlay(session: &mut Session, x: i32, y: i32) -> Option<Node> {
  let window = shell_window(session)?;
  let stage = window.children().into_iter().next()?;
  let area = stage.extents().map(|rect| rect.width * rect.height)?;
  let partial = |node: &Node| {
    node
      .extents()
      .is_none_or(|rect| covers(&rect, x, y) && rect.width * rect.height < area)
  };
  stage
    .children()
    .into_iter()
    .rev()
    .take(OVERLAY_LIMIT)
    .filter(|layer| partial(layer) && has_state(&layer.states(), STATE_SHOWING))
    .map(|layer| (layer.clone(), shell_hit(layer, x, y)))
    .find(|(layer, found)| !found.same(layer) && partial(found))
    .map(|(_, found)| found)
}

fn placement(app: &Node, window: Option<&Node>, target: &Target) -> ((i32, i32), u32) {
  let origin = (target.origin.0 + target.frame.0, target.origin.1 + target.frame.1);
  let gtk4 = app.property::<String>(APPLICATION, "ToolkitName").as_deref() == Some(GTK4);
  let blind = window
    .and_then(|window| window.extents())
    .is_some_and(|rect| rect.x == 0.0 && rect.y == 0.0 && origin != (0, 0));
  if gtk4 || blind {
    return (origin, WINDOW);
  }
  ((0, 0), SCREEN)
}

fn windows_of(app: &Node, target: &Target, fallback: impl Fn(&[u32]) -> bool) -> Vec<Node> {
  let candidates: Vec<(Node, Vec<u32>)> = app
    .children()
    .into_iter()
    .map(|window| {
      let states = window.states();
      (window, states)
    })
    .filter(|(_, states)| has_state(states, STATE_SHOWING))
    .collect();
  let (origin, coords) = placement(app, candidates.first().map(|(window, _)| window), target);
  let mut showing: Vec<(Node, Vec<u32>)> = candidates
    .into_iter()
    .map(|(window, states)| (window.placed(origin, coords), states))
    .collect();
  let first = target
    .title
    .as_ref()
    .and_then(|title| {
      showing
        .iter()
        .position(|(window, _)| window.text_property("Name").as_ref() == Some(title))
    })
    .or_else(|| showing.iter().position(|(_, states)| fallback(states)));
  if let Some(index) = first {
    let chosen = showing.remove(index);
    showing.insert(0, chosen);
  }
  showing.into_iter().map(|(window, _)| window).collect()
}

fn window_under(app: &Node, target: &Target, x: i32, y: i32) -> Option<Node> {
  let windows = windows_of(app, target, |_| true);
  let main = windows.first().cloned()?;
  if main.coords == WINDOW {
    return Some(main);
  }
  let covering: Vec<(ElementRect, Node)> = windows
    .into_iter()
    .take(WINDOW_LIMIT)
    .filter(|window| role_name(window).as_deref() != Some("tooltip"))
    .filter_map(|window| {
      let rect = window.extents()?;
      covers(&rect, x, y).then_some((rect, window))
    })
    .collect();
  covering
    .iter()
    .find(|(rect, _)| (rect.x as i32, rect.y as i32) == target.origin)
    .map(|(_, window)| window.clone())
    .or_else(|| {
      covering
        .into_iter()
        .min_by(|(left, _), (right, _)| (left.width * left.height).total_cmp(&(right.width * right.height)))
        .map(|(_, window)| window)
    })
    .or(Some(main))
}

fn covering_child(node: &Node, x: i32, y: i32) -> Option<Node> {
  node
    .children()
    .into_iter()
    .take(SCAN_LIMIT)
    .filter(|child| child.extents().is_some_and(|rect| covers(&rect, x, y)))
    .filter(|child| has_state(&child.states(), STATE_SHOWING))
    .last()
}

fn selected_tab(node: &Node) -> Option<Node> {
  if role_name(node).as_deref() != Some("tablist") {
    return None;
  }
  node
    .children()
    .into_iter()
    .take(SCAN_LIMIT)
    .find(|tab| has_state(&tab.states(), STATE_SELECTED))
}

fn deepest(start: Node, x: i32, y: i32) -> Node {
  let mut current = start;
  for _ in 0..MAX_DEPTH {
    let next = current
      .child_at(x, y)
      .or_else(|| covering_child(&current, x, y))
      .or_else(|| selected_tab(&current));
    match next {
      Some(found) => current = found,
      None => break,
    }
  }
  current
}

fn role_name(node: &Node) -> Option<String> {
  node.role().and_then(role)
}

fn is_generic(node: &Node) -> bool {
  matches!(role_name(node).as_deref(), None | Some("group" | "pane")) && node.text_property("Name").is_none()
}

fn controls_under(window: &Node, x: i32, y: i32) -> Option<Node> {
  matching_under(window, control_role_mask(), x, y)
}

fn menu_item_under(window: &Node, x: i32, y: i32) -> Option<Node> {
  matching_under(window, menu_item_mask(), x, y)
}

fn matching_under(window: &Node, roles: Vec<i32>, x: i32, y: i32) -> Option<Node> {
  let rule: MatchRule = (
    state_set(STATE_SHOWING),
    MATCH_ALL,
    HashMap::new(),
    MATCH_NONE,
    roles,
    MATCH_ANY,
    Vec::new(),
    MATCH_NONE,
    false,
  );
  let found: Vec<Reference> = window.call(
    COLLECTION,
    "GetMatches",
    &(rule, SORT_CANONICAL, CONTROL_SCAN_LIMIT, true),
  )?;
  let nodes: Vec<Node> = found
    .into_iter()
    .filter_map(|reference| window.related(reference))
    .collect();
  let boxes: Vec<Bounds> = nodes
    .iter()
    .map(|node| {
      node.extents().map_or((0, 0, 0, 0), |rect| {
        (
          rect.x as i32,
          rect.y as i32,
          (rect.x + rect.width) as i32,
          (rect.y + rect.height) as i32,
        )
      })
    })
    .collect();
  smallest_under(&boxes, x, y).map(|index| nodes[index].clone())
}

fn unresolved(node: &Node) -> bool {
  !is_control(role_name(node).as_deref())
}

fn area(node: &Node) -> f64 {
  node
    .extents()
    .map_or(f64::INFINITY, |rect| rect.width * rect.height)
}

fn smaller(candidate: Node, hit: Node) -> Node {
  if hit.text_property("Name").is_none() || area(&candidate) < area(&hit) {
    candidate
  } else {
    hit
  }
}

fn walk_controls_under(window: &Node, x: i32, y: i32) -> Option<Node> {
  let controls = control_roles();
  let mut budget = WALK_LIMIT;
  let mut stack = vec![window.clone()];
  let mut best: Option<(f64, Node)> = None;
  while let Some(node) = stack.pop() {
    if budget == 0 {
      break;
    }
    budget -= 1;
    let rect = node.extents();
    let role = node.role();
    let porous = matches!(
      role.and_then(crate::atspimap::role).as_deref(),
      Some("tab" | "menubar" | "menuitem" | "menu")
    );
    if !porous && rect.as_ref().is_some_and(|rect| !covers(rect, x, y)) {
      continue;
    }
    if !has_state(&node.states(), STATE_SHOWING) {
      continue;
    }
    if let (Some(rect), Some(role)) = (&rect, role) {
      if controls.contains(&(role as i32)) && covers(rect, x, y) {
        let area = rect.width * rect.height;
        if best.as_ref().is_none_or(|(smallest, _)| area <= *smallest) {
          best = Some((area, node.clone()));
        }
      }
    }
    stack.extend(node.children().into_iter().take(SCAN_LIMIT));
  }
  best.map(|(_, node)| node)
}

fn resolved_near(window: &Node, hit: &Node, x: i32, y: i32) -> Option<Node> {
  let mut scope = Some(hit.clone());
  for _ in 0..=CLIMB_LIMIT {
    let Some(node) = scope else { break };
    if let Some(found) = controls_under(&node, x, y) {
      return Some(found);
    }
    scope = node.parent();
  }
  controls_under(window, x, y).or_else(|| walk_controls_under(window, x, y))
}

fn promoted(hit: Node) -> Node {
  let role = role_name(&hit);
  if !is_generic(&hit) && !is_label(role.as_deref()) {
    return hit;
  }
  let mut current = hit.parent();
  for _ in 0..PROMOTE_DEPTH {
    let Some(found) = current else { break };
    if is_control(role_name(&found).as_deref()) {
      return found;
    }
    current = found.parent();
  }
  hit
}

fn node(found: &Node) -> ElementNode {
  ElementNode {
    role: role_name(found),
    name: found.text_property("Name"),
  }
}

fn ancestors(found: &Node) -> Vec<ElementNode> {
  let mut out = Vec::new();
  let mut current = found.parent();
  while let Some(parent) = current {
    if out.len() == MAX_ANCESTORS {
      break;
    }
    out.push(node(&parent));
    current = parent.parent();
  }
  out
}

fn describe(found: &Node) -> UiElement {
  let atspi_role = found.role();
  let role = atspi_role.and_then(role);
  let is_password = atspi_role == Some(PASSWORD_TEXT);
  let attributes = found.attributes();
  let reads_text = matches!(role.as_deref(), Some("textbox" | "combobox"));
  UiElement {
    role,
    name: found.text_property("Name"),
    automation_id: found
      .text_property("AccessibleId")
      .or_else(|| attributes.get("id").cloned()),
    value: if is_password || !reads_text {
      None
    } else {
      found.text()
    },
    help_text: found
      .text_property("Description")
      .and_then(|text| text.lines().next().map(str::to_owned))
      .or_else(|| attributes.get("placeholder-text").cloned()),
    is_password,
    value_length: if is_password {
      found.character_count()
    } else {
      None
    },
    rect: found.extents(),
    ancestors: Vec::new(),
    children: Vec::new(),
  }
}

fn name_from_label(node: &Node) -> Option<String> {
  let relations: Vec<(u32, Vec<Reference>)> = node.call(ACCESSIBLE, "GetRelationSet", &())?;
  relations
    .into_iter()
    .filter(|(kind, _)| *kind == LABELLED_BY)
    .flat_map(|(_, targets)| targets)
    .find_map(|target| {
      let label = node.related(target)?;
      label
        .text_property("Name")
        .or_else(|| label.text())
        .filter(|name| !name.trim().is_empty())
    })
}

fn name_from_content(node: &Node) -> Option<String> {
  let mut budget = CONTENT_LIMIT;
  let mut stack: Vec<Node> = node.children().into_iter().rev().collect();
  while let Some(current) = stack.pop() {
    if budget == 0 {
      break;
    }
    budget -= 1;
    if !has_state(&current.states(), STATE_SHOWING) {
      continue;
    }
    if is_label(role_name(&current).as_deref()) {
      if let Some(name) = current.text_property("Name") {
        return Some(name);
      }
    }
    stack.extend(current.children().into_iter().rev());
  }
  None
}

fn full(found: &Node) -> UiElement {
  let mut element = describe(found);
  let interactive = found
    .role()
    .is_some_and(|role| control_roles().contains(&(role as i32)));
  if element.name.is_none() && interactive {
    element.name = name_from_content(found).or_else(|| name_from_label(found));
  }
  if element.name.is_none() {
    element.ancestors = ancestors(found);
    element.children = found.children().iter().take(MAX_CHILDREN).map(node).collect();
  }
  element
}

fn overview_active(session: &Session) -> bool {
  session
    .desktop
    .call_method(
      Some(SHELL_BUS),
      SHELL_PATH,
      Some(PROPERTIES),
      "Get",
      &(SHELL_BUS, "OverviewActive"),
    )
    .ok()
    .and_then(|reply| reply.body().deserialize::<OwnedValue>().ok())
    .and_then(|value| bool::try_from(value).ok())
    .unwrap_or(false)
}

pub fn element_at_point(x: i32, y: i32) -> Option<UiElement> {
  let (conn, root) = x_root()?;
  let outside = !in_work_area(&conn, root, x, y);
  with_session(|session| {
    if outside || overview_active(session) {
      let window = shell_window(session)?;
      return Some(full(&promoted(shell_hit(window, x, y))));
    }
    if let Some(found) = shell_overlay(session, x, y) {
      return Some(full(&promoted(found)));
    }
    let popup = popup_at(&conn, root, x, y).and_then(|target| popup_root(session, &target));
    let window = match popup {
      Some(found) => found,
      None => {
        let target = target_at(&conn, root, x, y).filter(|found| found.pid != std::process::id())?;
        let app = app_for(session, target.pid)?;
        window_under(&app, &target, x, y)?
      }
    };
    let hit = promoted(deepest(window.clone(), x, y));
    let hit = if unresolved(&hit) {
      match resolved_near(&window, &hit, x, y) {
        Some(found) => smaller(found, hit),
        None => hit,
      }
    } else {
      hit
    };
    let hit = menu_item_under(&window, x, y).unwrap_or(hit);
    Some(full(&hit))
  })
}

type MatchRule = (
  Vec<i32>,
  i32,
  HashMap<String, String>,
  i32,
  Vec<i32>,
  i32,
  Vec<String>,
  i32,
  bool,
);

fn focused_in(window: &Node) -> Option<Node> {
  let rule: MatchRule = (
    state_set(STATE_FOCUSED),
    MATCH_ALL,
    HashMap::new(),
    MATCH_NONE,
    Vec::new(),
    MATCH_NONE,
    Vec::new(),
    MATCH_NONE,
    false,
  );
  let matches: Option<Vec<Reference>> =
    window.call(COLLECTION, "GetMatches", &(rule, SORT_CANONICAL, 1i32, true));
  if let Some(found) = matches.and_then(|found| found.into_iter().next()) {
    return window.related(found);
  }
  let mut queue = vec![window.clone()];
  let mut fields = Vec::new();
  let mut seen = 0;
  while let Some(current) = queue.pop() {
    seen += 1;
    if seen > FOCUS_SEARCH_LIMIT {
      break;
    }
    let states = current.states();
    if has_state(&states, STATE_FOCUSED) {
      return Some(current);
    }
    if has_state(&states, STATE_SHOWING) && role_name(&current).as_deref() == Some("textbox") {
      fields.push(current.clone());
    }
    queue.extend(current.children());
  }
  (fields.len() == 1).then(|| fields.remove(0))
}

pub fn focused_element() -> Option<UiElement> {
  let target = active_target().filter(|found| found.pid != std::process::id());
  with_session(|session| {
    if overview_active(session) {
      let window = shell_window(session)?;
      return Some(describe(&focused_in(&window).unwrap_or(window)));
    }
    let target = target?;
    let app = app_for(session, target.pid)?;
    let windows = windows_of(&app, &target, |states| has_state(states, STATE_ACTIVE));
    let window = windows.first().cloned()?;
    let heard = FOCUSED
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
      .filter(|(name, _)| *name == app.name)
      .and_then(|found| window.related(found))
      .filter(|found| has_state(&found.states(), STATE_FOCUSED));
    let found = heard
      .or_else(|| windows.iter().take(WINDOW_LIMIT).find_map(focused_in))
      .unwrap_or(window);
    Some(describe(&found))
  })
}
