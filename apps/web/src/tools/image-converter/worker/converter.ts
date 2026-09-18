import {
  ConversionFailure,
  describeFailure,
  failureCause,
  failureSentence,
} from "../core/failures";
import type { PlannedConversion } from "../core/plan";
import type { ConvertRequest, ConvertResponse } from "./worker";

export type Outcome =
  | {
      ok: true;
      conversion: PlannedConversion;
      bytes: Uint8Array<ArrayBuffer>;
      mime: string;
      width: number;
      height: number;
    }
  | { ok: false; conversion: PlannedConversion; message: string };

/**
 * How many Conversions may run at once.
 *
 * One core is left for the page itself; the cap keeps four Workers' worth of
 * WebAssembly from competing for memory on a machine that does not have it.
 */
export function defaultPoolSize(): number {
  const cores = typeof navigator === "undefined" ? 1 : (navigator.hardwareConcurrency ?? 1);

  return Math.max(1, Math.min(4, cores - 1));
}

/**
 * A pool of Workers that each hold all the codecs, creating them lazily.
 *
 * Workers are created on the first Batch and reused for its lifetime so a
 * several-megabyte codec is instantiated once per Worker, not once per file.
 */
export class ConversionPool {
  readonly #size: number;
  #workers: Worker[] = [];
  #pending = new Set<() => void>();
  #stopped = false;

  constructor(size: number = defaultPoolSize()) {
    this.#size = size;
  }

  async run(
    files: readonly File[],
    planned: readonly PlannedConversion[],
    onOutcome: (outcome: Outcome) => void,
  ): Promise<void> {
    if (planned.length === 0) return;

    this.#stopped = false;
    this.#workers = Array.from({ length: Math.min(this.#size, planned.length) }, () =>
      this.#createWorker(),
    );

    let claimed = 0;
    const claim = () =>
      this.#stopped || claimed >= planned.length ? undefined : planned[claimed++];

    await Promise.all(this.#workers.map((_, index) => this.#pump(index, files, claim, onOutcome)));
  }

  /** Stops every Worker, including one in the middle of a WebAssembly encode. */
  terminate(): void {
    this.#stopped = true;
    for (const worker of this.#workers) worker.terminate();
    this.#workers = [];
    // Deleting the current entry during iteration is defined behaviour for a Set.
    for (const abort of this.#pending) abort();
    this.#pending.clear();
  }

  #createWorker(): Worker {
    return new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  }

  /**
   * A Worker that stopped takes nothing further, and posting to it would never
   * settle — `postMessage` to a terminated Worker is silently dropped rather
   * than throwing. Replacing it is what keeps one crashed Conversion from
   * stalling the rest of the Batch.
   */
  #replaceWorker(index: number): void {
    this.#workers.at(index)?.terminate();
    this.#workers[index] = this.#createWorker();
  }

  async #pump(
    index: number,
    files: readonly File[],
    claim: () => PlannedConversion | undefined,
    onOutcome: (outcome: Outcome) => void,
  ): Promise<void> {
    for (;;) {
      const conversion = claim();
      if (!conversion) return;

      const file = files[conversion.sourceIndex];
      if (!file) {
        onOutcome({ ok: false, conversion, message: failureSentence("gone") });
        continue;
      }

      const worker = this.#workers.at(index);
      if (!worker) return;

      try {
        const bytes = await file.arrayBuffer();
        const response = await this.#send(worker, {
          id: conversion.id,
          bytes,
          format: conversion.format,
        });

        onOutcome(
          response.ok
            ? {
                ok: true,
                conversion,
                bytes: new Uint8Array(response.bytes),
                mime: response.mime,
                width: response.width,
                height: response.height,
              }
            : { ok: false, conversion, message: response.message },
        );
      } catch (error) {
        // Cancelling is not a mystery, so it does not get a console line;
        // anything else does, including the Worker that just died — which is
        // why the rejection below carries the event's own error as its cause.
        if (!(error instanceof ConversionFailure) || !this.#stopped) {
          // oxlint-disable-next-line no-console -- the raw failure is the only clue for the ones we cannot explain.
          console.error(`Conversion ${conversion.id} failed:`, failureCause(error));
        }
        onOutcome({ ok: false, conversion, message: describeFailure(error) });
        if (!this.#stopped) this.#replaceWorker(index);
      }
    }
  }

  /** The Worker takes one Conversion at a time, so an id is enough to match up. */
  #send(worker: Worker, request: ConvertRequest): Promise<ConvertResponse> {
    return new Promise((resolve, reject) => {
      const settle = (result: () => void) => {
        this.#pending.delete(abort);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        result();
      };
      const abort = () => settle(() => reject(new ConversionFailure("interrupted")));
      const onError = (event: ErrorEvent) =>
        settle(() =>
          reject(new ConversionFailure("interrupted", { cause: event.error ?? event.message })),
        );
      const onMessage = (event: MessageEvent<ConvertResponse>) => {
        if (event.data.id !== request.id) return;
        settle(() => resolve(event.data));
      };

      this.#pending.add(abort);
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage(request, [request.bytes]);
    });
  }
}
