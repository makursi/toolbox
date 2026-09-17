# Image codecs run single-threaded, in a Worker, without cross-origin isolation

The image Tool needs encoders no browser ships: AVIF and BMP cannot be produced from a canvas at all, and MozJPEG, libwebp and oxipng produce better files than `canvas.toBlob` does. The decision is that every one of them runs inside a Web Worker, with the page passing file bytes in and encoded bytes out; that decoding uses the browser's own `createImageBitmap`; and that the **single-threaded** builds are the ones that ship.

The multi-threaded builds are not a preference. **Turbopack 16.3.5 hangs `next build` on both of them** — @jsquash/avif's `avif_enc_mt` (and its nested `avif_enc_mt.worker.mjs`) and @jsquash/oxipng's wasm-bindgen-rayon `pkg-parallel` build. Measured on this repo: a baseline `next build` takes about 10 seconds, and with either module in the graph the build was still running after 25 minutes and had to be killed. Importing the wrappers or the codecs directly makes no difference, so the wrappers are bypassed for their single-threaded builds rather than dropped: `@jsquash/avif/codec/enc/avif_enc.js` and `@jsquash/oxipng/codec/pkg/squoosh_oxipng.js`.

## Consequences

- **The site is not cross-origin isolated.** The plan for this Tool was to set `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` so `SharedArrayBuffer` would be available for a multi-threaded AVIF encode. With both threaded codecs unbundlable, those headers would buy nothing while costing the blast radius of `COEP` — every future cross-origin subresource would have to opt in. They are not set; `docs/adr/0005-no-outbound-requests.md` still constrains what may be loaded, and that is done with the CSP alone. If Turbopack learns to bundle these, the threaded builds are one import away — and the headers have to come back with them.
- AVIF encoding is slower than it could be. Squoosh's own numbers for a single-threaded libavif encode of a 1600×719 photo are in the 1–2 second range, which is why this runs in a Worker and why the pool keeps several of them busy instead of freezing the page.
- The `avif_enc.wasm` asset is 3.3 MB. It is a dynamic import inside the Worker, so it is only fetched when someone actually converts to AVIF — but @jsquash/resize used to statically import three resize backends, so its hqx and magic-kernel WebAssembly shipped whether or not they were used (~150 KB). **That dependency is gone**: the Tool no longer resizes or rotates, and `@jsquash/resize` was removed with the output settings — see `docs/adr/0010-no-output-settings.md`.
- PNG output goes through a canvas (unoptimised) and then through single-threaded oxipng, which is a second pass and not a hard dependency: if it fails, the bigger PNG is kept rather than failing the Conversion.
- The hand-written BMP encoder exists because 24-bit BMP is the one output format with no codec in the dependency set and no browser support. See `core/bmp.ts`.

## Considered Options

- **COOP/COEP and the multi-threaded codecs**: rejected — the headers cannot deliver anything if the threaded modules cannot be built.
- **Copying the threaded codec into `public/` and loading it outside the bundler**: rejected for now. It would defeat the bundler's content hashing and cache invalidation for a several-megabyte binary, and it could not be verified without a real browser. It is the option to revisit if AVIF encode time becomes the thing people complain about.
- **Shipping WASM decoders** (`@jsquash/*/decode`): rejected — PNG, JPEG, WebP, AVIF and BMP all decode natively, so the decoders would add about 1.5 MB to defend against a case that does not occur. `sniffFormat` is what routes a file, and HEIC is refused with a message rather than decoded.
- **Dropping oxipng** because of its stale release: rejected — it is only a second pass over PNG data the canvas already produced, and the single-threaded build works.
