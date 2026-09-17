import type {
  AVIFModule,
  EncodeOptions as AvifEncodeOptions,
} from "@jsquash/avif/codec/enc/avif_enc.js";
import { defaultOptions as avifDefaults } from "@jsquash/avif/meta.js";
import { defaultOptions as oxipngDefaults } from "@jsquash/oxipng/meta.js";

/**
 * The worker side of a Conversion.
 *
 * Everything expensive happens here so the page stays responsive: decode,
 * flatten, encode. The protocol is one request in (the file's bytes are
 * *transferred*, not copied) and one response out.
 *
 * Two codecs are reached through their single-threaded builds on purpose. The
 * multi-threaded libavif encoder and the wasm-bindgen-rayon build of oxipng both
 * hang `next build` under Turbopack 16.3.5 — see ADR-0004 — so their wrappers
 * (`@jsquash/avif/encode`, `@jsquash/oxipng`) are bypassed rather than dropped.
 */
import { encodeBmp } from "../core/bmp";
import { ConversionFailure, describeFailure, failureCause } from "../core/failures";
import { flattenBackground, formatSpecs } from "../core/formats";
import { checkLimits } from "../core/limits";
import { resolveEncodeOptions, type EncodeOptions, type TargetSettings } from "../core/options";

export type ConvertRequest = {
  id: number;
  bytes: ArrayBuffer;
  target: TargetSettings;
};

export type ConvertResponse =
  | { id: number; ok: true; bytes: ArrayBuffer; mime: string; width: number; height: number }
  | { id: number; ok: false; message: string };

/**
 * Just enough of the worker global to talk over `postMessage`.
 *
 * Spelled out rather than pulled from the `WebWorker` lib, which cannot be
 * loaded alongside `DOM` without the two disagreeing about shared names.
 */
type WorkerContext = {
  addEventListener: (
    type: "message",
    listener: (event: MessageEvent<ConvertRequest>) => void,
  ) => void;
  postMessage: (message: ConvertResponse, transfer?: Transferable[]) => void;
};

// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- `self` is the worker global at runtime; the DOM lib types it as a Window.
const context = self as unknown as WorkerContext;

context.addEventListener("message", (event: MessageEvent<ConvertRequest>) => {
  void respond(event.data);
});

async function respond(request: ConvertRequest): Promise<void> {
  try {
    const result = await run(request);
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
    context.postMessage({ id: request.id, ok: true, ...result }, [result.bytes]);
  } catch (error) {
    // The visitor gets the sentence; the console gets the thing that actually
    // threw — for the failures we named that is the browser's or the codec's own
    // complaint, and for the rest it is the only clue there is.
    // oxlint-disable-next-line no-console -- a failed Conversion is worth one line, and a Worker has nowhere else to put it.
    console.error(`Conversion ${request.id} failed:`, failureCause(error));
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- a worker's postMessage takes a transfer list, not a target origin.
    context.postMessage({ id: request.id, ok: false, message: describeFailure(error) });
  }
}

async function run(request: ConvertRequest) {
  const spec = formatSpecs[request.target.format];
  const bitmap = await decode(request.bytes);

  try {
    // Browsers disagree about what a canvas does past its area limit — throw,
    // blank, or clamp — so this is the only place the pixel limit can be
    // enforced the same way everywhere. It fails this Conversion alone.
    const pixels = checkLimits({ width: bitmap.width, height: bitmap.height });
    if (!pixels.ok) {
      throw new ConversionFailure("too-many-pixels", { sentence: pixels.message });
    }

    // The canvas is the whole conversion now: no rotation, no scaling, so the
    // output is the source's own pixels. Flattening happens here because it has
    // to happen before the pixels reach a codec with no alpha channel.
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context2d = canvas.getContext("2d", { alpha: spec.alpha });
    if (!context2d) throw new ConversionFailure("canvas");

    if (!spec.alpha) {
      context2d.fillStyle = flattenBackground;
      context2d.fillRect(0, 0, canvas.width, canvas.height);
    }

    context2d.drawImage(bitmap, 0, 0);

    const image = context2d.getImageData(0, 0, bitmap.width, bitmap.height);
    const bytes = await encodeOrFail(image, request.target);

    return { bytes, mime: spec.mime, width: image.width, height: image.height };
  } finally {
    bitmap.close();
  }
}

/**
 * A file that will not decode is the failure a visitor is most likely to meet,
 * and the browser's message for it is written for a developer: "The source
 * image could not be decoded."
 */
async function decode(bytes: ArrayBuffer): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(new Blob([bytes]), { imageOrientation: "from-image" });
  } catch (error) {
    throw new ConversionFailure("decode", { cause: error });
  }
}

/**
 * The Worker knows it was in the encode step; it does not know why the codec
 * refused, so the sentence names the step and offers the two things that might
 * help rather than guessing at a cause. The codec's own error is kept as the
 * cause and goes to the console.
 *
 * Our own failures pass straight through: `encode` also reaches `encodePng`,
 * which raises `canvas`, and re-labelling that one as an encode failure would
 * make the `canvas` sentence unreachable.
 */
async function encodeOrFail(image: ImageData, target: TargetSettings): Promise<ArrayBuffer> {
  try {
    return await encode(image, target);
  } catch (error) {
    throw error instanceof ConversionFailure
      ? error
      : new ConversionFailure("encode", { cause: error });
  }
}

async function encode(image: ImageData, target: TargetSettings): Promise<ArrayBuffer> {
  const options = resolveEncodeOptions(target);

  switch (target.format) {
    case "jpeg": {
      const { default: encodeJpeg } = await import("@jsquash/jpeg/encode");

      return encodeJpeg(image, options);
    }
    case "webp": {
      const { default: encodeWebp } = await import("@jsquash/webp/encode");

      return encodeWebp(image, options);
    }
    case "avif":
      return encodeAvif(image, options);
    case "png":
      return optimisePng(await encodePng(image), options);
    case "bmp":
      return toArrayBuffer(encodeBmp(image));
    default:
      throw new Error(`不支持的目标格式：${String(target.format)}`);
  }
}

async function encodePng(image: ImageData): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const context2d = canvas.getContext("2d");
  if (!context2d) throw new ConversionFailure("canvas");

  context2d.putImageData(image, 0, 0);
  const blob = await canvas.convertToBlob({ type: "image/png" });

  return new Uint8Array(await blob.arrayBuffer());
}

/**
 * libavif's single-threaded build, instantiated once per worker.
 *
 * Memoised because the module is several megabytes, and an Emscripten instance
 * cannot serve two conversions at once — the pool guarantees this worker only
 * ever has one in flight.
 */
let avifModule: Promise<AVIFModule> | undefined;

async function encodeAvif(image: ImageData, options: EncodeOptions): Promise<ArrayBuffer> {
  const { default: createModule } = await import("@jsquash/avif/codec/enc/avif_enc.js");
  const codec = await loadAvifModule(createModule);

  // The codec's marshaller throws on any field it does not receive, so the
  // defaults are spread in here — that is the job the wrapper normally does.
  const codecOptions: AvifEncodeOptions = { ...avifDefaults, ...options };
  const output = codec.encode(
    new Uint8Array(image.data.buffer),
    image.width,
    image.height,
    codecOptions,
  );
  if (!output) throw new ConversionFailure("encode");

  return toArrayBuffer(output);
}

/**
 * Instantiate libavif once per worker, and forget a failure.
 *
 * Memoised because the module is several megabytes, and an Emscripten instance
 * cannot serve two conversions at once — the pool guarantees this worker only
 * ever has one in flight. A rejected promise is cleared rather than kept, so
 * one failed fetch of the 3.3 MB asset does not fail every later AVIF
 * Conversion in this worker.
 */
async function loadAvifModule(
  createModule: (options: { noInitialRun: boolean }) => Promise<AVIFModule>,
): Promise<AVIFModule> {
  avifModule ??= createModule({ noInitialRun: true }).catch((error: unknown) => {
    avifModule = undefined;
    throw error;
  });

  return avifModule;
}

/** oxipng's single-threaded build, used as a lossless second pass over the PNG. */
let oxipngModule: Promise<typeof import("@jsquash/oxipng/codec/pkg/squoosh_oxipng.js")> | undefined;

async function optimisePng(png: Uint8Array, options: EncodeOptions): Promise<ArrayBuffer> {
  const level = typeof options.level === "number" ? options.level : 2;

  try {
    oxipngModule ??= import("@jsquash/oxipng/codec/pkg/squoosh_oxipng.js").then(async (module) => {
      await module.default();

      return module;
    });

    const { optimise } = await oxipngModule;

    return toArrayBuffer(
      optimise(png, level, oxipngDefaults.interlace, oxipngDefaults.optimiseAlpha),
    );
  } catch {
    // Optimisation is a second pass, not the Conversion: a larger PNG is a
    // better outcome than a failed file.
    return toArrayBuffer(png);
  }
}

/** Emscripten hands back a view over its whole heap, so the used range is copied out. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}
