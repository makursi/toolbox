import type { Editor } from "@tiptap/react";

import {
  SNIFF_BYTES,
  admitImage,
  imageUsage,
  imageUsageAfterReplacement,
  type AdmissionState,
  type ImageRefusal,
} from "../core/admission";
import { DEFAULT_IMAGE_WIDTH } from "./image-extension";

/**
 * The one insert three paths share, and the one replacement the image panel's 替换
 * uses (#216, #218).
 *
 * The toolbar's 插入图片, a drop on the canvas and a paste all end here, which is the
 * point: three ways in and one admission is what keeps "what may be inserted" a
 * single answer. This module is the browser half — it reads a file and calls the
 * extension's command — while the rules it obeys are `core/admission.ts`'s and the
 * words are `core/copy.ts`'s.
 *
 * It reads sixteen bytes and the declared size first, and the rest of the file only
 * after admission says yes: a file over its limit is refused without being read,
 * which is what "the size is read before the file" is for.
 *
 * 替换 goes through the same read-and-admit, because a replacement is a file joining
 * the document under the same four limits; what it does not do is count itself as a
 * new image (`imageUsageAfterReplacement`), and what it does not touch is the alt
 * text and the width — those are the panel's fields, and overwriting a description
 * the visitor wrote because the bytes changed would be a silent edit of their words.
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
 * What reading one file answers: refused by a rule, kept as a `data:` URL, or
 * unreadable.
 *
 * `unreadable` is a third answer rather than a fifth refusal: a local file the
 * browser will not hand back is not one of the four rules and has no sentence of its
 * own, so the canvas stays as it was rather than growing a line the visitor cannot
 * act on. Keeping it apart from `refused` is what lets both callers share one path
 * and still say different things about the two.
 */
type ReadResult =
  | { readonly kind: "refused"; readonly refusal: ImageRefusal }
  | { readonly kind: "ready"; readonly src: string }
  | { readonly kind: "unreadable" };

/**
 * Read one file and admit it, against the usage the caller names at each check.
 *
 * `usage` is a function rather than a value because it is asked twice: once before
 * the bytes are read (so a file over its limit is never read) and once after (so a
 * document that filled up while a picture was being encoded cannot take one more
 * than it may). Passing the usage rather than the document is also what lets a
 * replacement be measured as one image fewer without a second copy of this path.
 */
async function readAndAdmit(file: File, usage: () => AdmissionState): Promise<ReadResult> {
  const head = await readHead(file);
  const first = admitImage({ head, size: file.size }, usage());
  if (first.kind === "refused") return first;

  let src: string;
  try {
    src = await readDataUrl(file);
  } catch {
    return { kind: "unreadable" };
  }

  const again = admitImage({ head, size: file.size }, usage());
  if (again.kind === "refused") return again;

  return { kind: "ready", src };
}

/**
 * Insert one file at the selection, or answer which rule refused it.
 *
 * `null` means inserted. The re-check after the bytes are read is not paranoia: two
 * files dropped together are admitted one after the other, but a visitor can also
 * paste while the first file is still being encoded, and a document may only ever
 * hold what the second look says it can.
 */
export async function insertImageFile(editor: Editor, file: File): Promise<ImageRefusal | null> {
  const result = await readAndAdmit(file, () => imageUsage(editor.getJSON()));

  if (result.kind === "refused") return result.refusal;
  if (result.kind === "unreadable") return null;

  editor
    .chain()
    .focus()
    .setImage({ alt: altFromName(file.name), src: result.src, width: DEFAULT_IMAGE_WIDTH })
    .run();

  return null;
}

/** The image a replacement targets: the node the panel is drawn for. */
export interface ImageReplacement {
  /** The node's position, which the command needs to reach it after the popover. */
  readonly pos: number;
  /** The source it holds now, which is the bytes its replacement frees. */
  readonly src: string;
}

/**
 * Replace one image's bytes, or answer which rule refused the file (#218).
 *
 * `null` means the image now holds the new file, or that the file could not be read
 * and nothing was touched: both leave the image as the visitor meant it, and neither
 * shows a sentence. A refusal is the four rules' and shows the copy layer's sentence,
 * with the picture exactly as it was.
 *
 * The position is set explicitly rather than trusting whatever the selection is when
 * the file arrives: opening the picker, and the OS dialog in front of it, is enough
 * time for a focus change, and a replacement that rewrote the wrong image would be a
 * silent edit of the document. The alt text and width are deliberately not passed to
 * `updateAttributes` — it merges, so they keep the values the document already has.
 */
export async function replaceImageFile(
  editor: Editor,
  image: ImageReplacement,
  file: File,
): Promise<ImageRefusal | null> {
  const result = await readAndAdmit(file, () =>
    imageUsageAfterReplacement(imageUsage(editor.getJSON()), image.src),
  );

  if (result.kind === "refused") return result.refusal;
  if (result.kind === "unreadable") return null;

  editor
    .chain()
    .focus()
    .setNodeSelection(image.pos)
    .updateAttributes("image", { src: result.src })
    .run();

  return null;
}
