/** Space kept between an open drop-down list and the edge of the screen. */
export const LIST_MARGIN = 12

export interface ListPlacement {
  left: number
  /** At least the field's width, but never more than fits on screen. */
  minWidth: number
  /** The list may grow for a long label, but stops short of the right edge so it never touches it. */
  maxWidth: number
}

/**
 * Where an open list sits horizontally: under the field's left edge, widened for long labels, and
 * always inside the screen with a margin on each side (labels wrap when there is no more room).
 */
export function placeList(
  field: { left: number; width: number },
  viewportWidth: number,
): ListPlacement {
  const room = viewportWidth - 2 * LIST_MARGIN
  const minWidth = Math.min(field.width, room)
  const left = Math.max(LIST_MARGIN, Math.min(field.left, viewportWidth - LIST_MARGIN - minWidth))
  return { left, minWidth, maxWidth: viewportWidth - LIST_MARGIN - left }
}
