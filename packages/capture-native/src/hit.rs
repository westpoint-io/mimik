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

#[cfg(test)]
mod tests {
  use super::smallest_under;

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
}
