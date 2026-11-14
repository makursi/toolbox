/**
 * The one rule that keeps a produced file from going stale.
 *
 * A document is built from two things: the paper and the list, in order. Any
 * change to either of them makes the file on screen describe a page the visitor
 * is no longer looking at, so the result is taken away and 转换 is re-armed. This
 * Tool has five such changes — add, remove, clear, reorder and the paper — and
 * they all ask this function; `ImageToPdf.tsx` has one door that resets only when
 * the answer is yes. A sixth change goes through that door too, which is why the
 * rule is here and not one `reset()` per handler.
 *
 * It is not an error state: invalidation returns the page to "not converted
 * yet", with no banner and no failure sentence.
 *
 * Two changes are not a change to the document, and the rule says so once rather
 * than every caller remembering it: a batch in which every file was refused never
 * joined the list, and a row dropped where it started is the same order. Neither
 * may throw away a file that still matches the page.
 *
 * The module is pure, so the unit test can hold the whole matrix; the gate then
 * proves the page actually asks it after a file exists.
 */

/** A change a visitor can make to the document a produced file was built from. */
export type DocumentChange =
  | { kind: "paper" }
  | { kind: "add"; accepted: number }
  | { kind: "remove" }
  | { kind: "clear" }
  | { kind: "reorder"; moved: boolean };

/**
 * Whether this change makes a produced file stale.
 *
 * The switch has no `default`, and the return type is `boolean` rather than
 * `boolean | undefined` on purpose: a sixth kind of change becomes a type error
 * here until its author decides, in this one place, whether the document
 * changed. A `default: true` would let that decision go unmade.
 */
// oxlint-disable-next-line typescript/consistent-return -- every kind returns; the switch deliberately has no `default`, so a sixth kind of change is a type error here until its author decides, which is the bug this shape prevents.
export function invalidates(change: DocumentChange): boolean {
  switch (change.kind) {
    case "paper":
      // A file built for A4 cannot stay on screen while every row draws Letter.
      return true;

    case "add":
      // `accepted` is how many files became pages. A batch that was entirely
      // refused did not touch the list, so the file still matches it.
      return change.accepted > 0;

    case "remove":
      // The remove control exists only on a row that is in the list, so a
      // remove that happened always took a page out of the document.
      return true;

    case "clear":
      // 清空 exists only while the list has pages, so it always empties one.
      return true;

    case "reorder":
      // The list hook answers whether the order actually changed: a drop back
      // onto the row's own position is not a new document.
      return change.moved;
  }
}
