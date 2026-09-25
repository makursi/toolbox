/**
 * Read a visitor's file as a `data:` URL. `data:` needs no fetch and is allowed
 * by `img-src`, so SnapDOM can inline it under this site's CSP; a `blob:` URL
 * would be fetched and blocked by `connect-src 'self'` (the #61 finding in the
 * README).
 *
 * Shared by the background upload (in the composition hook) and the icon upload
 * (in the component), which is the one reason it lives at the Tool's root
 * rather than inside either.
 */
export function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener(
      "load",
      () => {
        const result = reader.result;
        if (typeof result === "string") resolve(result);
        else reject(new Error("expected a data: URL"));
      },
      { once: true },
    );
    reader.addEventListener("error", () => reject(reader.error), { once: true });
    reader.readAsDataURL(file);
  });
}
