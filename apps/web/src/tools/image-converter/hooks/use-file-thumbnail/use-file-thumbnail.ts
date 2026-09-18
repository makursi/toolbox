import { useEffect, useRef, useState } from "react";

/** The width a thumbnail is decoded to before the browser shows it in a 40px box. */
const thumbnailWidth = 80;

/**
 * One thumbnail at a time, in the order the rows appear.
 *
 * A visit that adds twenty photos mounts twenty of these at once, and twenty
 * simultaneous decodes of 20 MP files is how a page stops answering. Chaining
 * them means the picture that is already on screen is never waiting behind a
 * decode nobody has looked at yet.
 *
 * The chain lives at module scope because the rows are separate components with
 * nothing above them to hold it, and one page renders one Tool. Nothing here
 * carries a rejection into the next job: a file that will not decode must not
 * take the queue down with it.
 */
let chain: Promise<void> = Promise.resolve();

function inOrder<T>(job: () => Promise<T>): Promise<T> {
  const started = chain.then(job);
  chain = started.then(
    () => undefined,
    () => undefined,
  );

  return started;
}

/**
 * A picture of one file, as a `blob:` URL, or `null` while there is none.
 *
 * `null` covers "still being made" and "could not be made" alike, on purpose: the
 * row draws nothing in both cases, so a file whose bytes will not decode leaves
 * an empty box rather than an empty frame claiming to be a picture.
 *
 * The URL is created once and revoked once, both by the effect that made it. The
 * state remembers which file it was made for, so a row React reuses for a
 * different file cannot show the previous file's picture while the new one is
 * still decoding.
 */
export function useFileThumbnail(file: File): string | null {
  const [made, setMade] = useState<{ file: File; url: string } | null>(null);
  const created = useRef<string | null>(null);

  useEffect(() => {
    let live = true;

    // A file removed while its thumbnail is still queued behind others costs
    // nothing to skip: the check happens when the job starts, not when it was
    // queued.
    void inOrder(() => (live ? makeThumbnail(file) : Promise.resolve(null))).then((url) => {
      if (!live) {
        if (url !== null) URL.revokeObjectURL(url);
        return;
      }

      created.current = url;
      if (url !== null) setMade({ file, url });
    });

    return () => {
      live = false;
      if (created.current !== null) URL.revokeObjectURL(created.current);
      created.current = null;
    };
  }, [file]);

  return made?.file === file ? made.url : null;
}

/**
 * Decode, shrink, and hand back a URL — or `null`, having said why in the
 * console. The visitor gets nothing here: a row with no picture and a row with a
 * picture are the same row, and the frame is decoration for the name beside it.
 *
 * The resize is the browser's own, one decode for both steps, and it keeps the
 * aspect ratio: the 40px box crops with `object-fit` rather than the decode
 * stretching a face to a square.
 */
async function makeThumbnail(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file, {
      resizeQuality: "low",
      resizeWidth: thumbnailWidth,
    });

    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) return null;

      context.drawImage(bitmap, 0, 0);

      return URL.createObjectURL(await canvas.convertToBlob({ type: "image/png" }));
    } finally {
      bitmap.close();
    }
  } catch (error) {
    // oxlint-disable-next-line no-console -- the list stays silent when a thumbnail fails, so the console is the only place the reason survives.
    console.warn(`Thumbnail for ${file.name} failed:`, error);

    return null;
  }
}
