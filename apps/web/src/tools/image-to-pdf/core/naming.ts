/**
 * Output file names: the file names itself, and no field asks the visitor for a
 * name.
 *
 * The date is the visitor's own calendar day, read from the local fields. A name
 * built from UTC fields would roll over at the wrong hour for most of the world,
 * which is the only way this rule can be wrong.
 */

/** `图片-YYYY-MM-DD.pdf`, from a date. */
export function pdfFileName(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `图片-${year}-${month}-${day}.pdf`;
}
