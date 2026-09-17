import { useEffect, useMemo } from "react";

/**
 * A `blob:` URL for some binary data, revoked when the data changes or the
 * component goes away.
 *
 * The URL is derived during render and revoked in an effect's cleanup, which is
 * what the alternative does not do. An effect that creates the URL and then
 * calls `setUrl` is the shape this library's lint refuses — `set-state-in-effect`
 * — and it would cost a frame with an empty `href` as well. The trade-off that
 * buys is that rendering is not pure: React may render a component more than
 * once for the same props (Strict Mode does it on purpose in development), and a
 * discarded render would leave a URL behind with nothing pointing at it. It is a
 * development-only cost, and the alternative is refused by the toolchain, so it
 * is written down rather than worked around.
 *
 * The data is expected to be immutable for the life of the element — every
 * finished Conversion is its own element, keyed by its id — which is what makes
 * "create once, revoke once" true in practice.
 */
export function useObjectUrl(data: BlobPart, type: string): string {
  const url = useMemo(() => URL.createObjectURL(new Blob([data], { type })), [data, type]);

  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  return url;
}
