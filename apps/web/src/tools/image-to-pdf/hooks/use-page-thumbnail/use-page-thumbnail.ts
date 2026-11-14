import { useEffect, useRef, useState } from "react";

/**
 * A small picture of one page's image, as a `blob:` URL, or `null` while there
 * is none.
 *
 * One decode at a time, in list order: a visit that adds twenty photos mounts
 * twenty rows at once, and twenty simultaneous decodes of large files is how a
 * page stops answering. The chain lives at module scope because the rows are
 * separate components with nothing above them to hold it; a rejected job never
 * carries into the next.
 *
 * `null` covers "still being made" and "could not be made" alike: the row draws
 * an empty page in both cases, because the page's shape is still true even when
 * its picture is not there. The URL is created once and revoked by the effect
 * that made it, and the state remembers which file it belongs to so a reused row
 * cannot show the previous file's picture.
 */

const thumbnailWidth = 160;

let chain: Promise<void> = Promise.resolve();

function inOrder<T>(job: () => Promise<T>): Promise<T> {
  const started = chain.then(job);
  chain = started.then(
    () => undefined,
    () => undefined,
  );

  return started;
}

export function usePageThumbnail(file: File): string | null {
  const [made, setMade] = useState<{ file: File; url: string } | null>(null);
  const created = useRef<string | null>(null);

  useEffect(() => {
    let live = true;

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
 * Decode, shrink and hand back a URL, or `null` after saying why in the console.
 * The visitor gets nothing here: a page with no picture still has its shape, and
 * the file's name is beside it either way.
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
    // oxlint-disable-next-line no-console -- the row stays silent when a thumbnail fails, so the console is the only place the reason survives.
    console.warn(`Thumbnail for ${file.name} failed:`, error);

    return null;
  }
}
