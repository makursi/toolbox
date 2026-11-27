import type { Editor } from "@tiptap/react";

import { SNIFF_BYTES, admitImage, imageUsage, type ImageRefusal } from "../core/admission";
import { DEFAULT_IMAGE_WIDTH } from "./image-extension";

/**
 * The one insert three paths share: a file becomes an image node, or it is refused
 * with the rule it broke (#216).
 *
 * The toolbar's 插入图片, a drop on the canvas and a paste all end here, which is
 * the point: three ways in and one admission is what keeps "what may be inserted"
 * a single answer. This module is the browser half — it reads a file and calls the
 * extension's command — while the rules it obeys are `core/admission.ts`'s and the
 * words are `core/copy.ts`'s.
 *
 * It reads sixteen bytes and the declared size first, and the rest of the file only
 * after admission says yes: a file over its limit is refused without being read,
 * which is what "the size is read before the file" is for.
 */

/** Whether a dropped or pasted file is one this Tool should try to admit. */
function looksLikeImage(file: File): boolean {
  // The declared type is the browser's guess and the name is the visitor's, so
  // neither decides anything: a `not-an-image.png` still goes to the sniffer and is
  // refused there. The test is only "is this worth interrupting the drop for".
  return file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

/**
 * The image files in a drop or paste, in the order the platform lists them.
 *
 * A drop that carries no files (a moved node, dragged text, a link) answers an
 * empty list, which is how both handlers stay out of ProseMirror's way.
 */
export function imageFiles(data: DataTransfer | null): readonly File[] {
  if (data === null) return [];

  return [...data.files].filter(looksLikeImage);
}

/** The file's first bytes: the only part read before the decision. */
async function readHead(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, SNIFF_BYTES).arrayBuffer());
}

/**
 * The file as a `data:` URL.
 *
 * `FileReader` rather than assembling base64 from an `ArrayBuffer`: a 5 MB picture is
 * four million characters, and a hand-rolled encoder with a spread call is how that
 * becomes a stack overflow in the one path the limits exist to keep large.
 */
function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      // `result` is a string for a data URL and an ArrayBuffer only for the other
      // read modes this module never asks for; the union is why this is a check
      // rather than a cast, and the browser answering anything else is a read that
      // did not produce a URL.
      const result = reader.result;

      if (typeof result === "string") resolve(result);
      else reject(new Error("the image could not be read as a data URL"));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("the image could not be read"));
    });
    reader.readAsDataURL(file);
  });
}

/**
 * Alt text when nothing better is known: the file's own name without its extension.
 *
 * An `<img>` with no alt is announced by its file name at best and skipped at worst;
 * the visitor's name for the picture is the only description available before the
 * image panel (#218) offers a field for it.
 */
function altFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, "").trim();

  return base === "" ? "图片" : base;
}

/**
 * Insert one file, or answer which rule refused it.
 *
 * `null` means inserted. The re-check after the bytes are read is not paranoia: two
 * files dropped together are admitted one after the other, but a visitor can also
 * paste while the first file is still being encoded, and a document may only ever
 * hold what the second look says it can.
 */
export async function insertImageFile(editor: Editor, file: File): Promise<ImageRefusal | null> {
  const head = await readHead(file);
  const first = admitImage({ head, size: file.size }, imageUsage(editor.getJSON()));
  if (first.kind === "refused") return first.refusal;

  let src: string;
  try {
    src = await readDataUrl(file);
  } catch {
    // A local file the browser cannot read is not one of the four rules and has no
    // sentence of its own; the canvas stays as it was rather than growing a line
    // the visitor cannot act on.
    return null;
  }

  const again = admitImage({ head, size: file.size }, imageUsage(editor.getJSON()));
  if (again.kind === "refused") return again.refusal;

  editor
    .chain()
    .focus()
    .setImage({ alt: altFromName(file.name), src, width: DEFAULT_IMAGE_WIDTH })
    .run();

  return null;
}
