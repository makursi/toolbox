/**
 * Where a page goes when the visitor moves it.
 *
 * Both reordering paths — dragging a handle and the keyboard — end in the same
 * question: the list is ordered, the visitor moved the item at one position onto
 * another, what is the new order? dnd-kit reports ids; the page list turns them
 * into positions and asks this function.
 *
 * It lives in the pure layer because the semantics are testable in Node: the
 * list closes the gap the moved item left, and an instruction that names a
 * position the list does not have changes nothing. The component above it only
 * maps ids to positions and keeps the result.
 */
export function movePage<T>(pages: readonly T[], from: number, to: number): T[] {
  // A drop outside the list, or an item that no longer exists, is not an
  // instruction to move anything. A list half-moved by a stale id would be a
  // document whose order nobody chose.
  if (!isPosition(from, pages.length) || !isPosition(to, pages.length) || from === to) {
    return [...pages];
  }

  const next = [...pages];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...pages];

  next.splice(to, 0, moved);
  return next;
}

/** Whether `value` names one of `length` positions. */
function isPosition(value: number, length: number): boolean {
  return Number.isInteger(value) && value >= 0 && value < length;
}
