import { useCallback, useEffect, useRef, useState } from "react";

import type { TargetSettings } from "@/tools/image-converter/core/options";
import { planConversions, type PlannedConversion } from "@/tools/image-converter/core/plan";
import { ConversionPool, type Outcome } from "@/tools/image-converter/worker/converter";

/**
 * One Batch: what it will produce, how far it has got, and the way to stop it.
 *
 * The plan is settled before any work starts, so the download list knows every
 * name it will hold while the first Conversion is still running — the names are
 * a product decision (see `planConversions`), not a race between Workers.
 *
 * Nothing here decides anything the pure half already decides: what a Batch *is*
 * comes from `planConversions`, and what a Conversion does comes from the pool
 * and its Worker. This is the state that has to survive between renders, which is
 * the whole reason it is a hook and not a function.
 */
export function useConversionBatch() {
  const [running, setRunning] = useState(false);
  const [planned, setPlanned] = useState<PlannedConversion[]>([]);
  const [outcomes, setOutcomes] = useState<Outcome[]>([]);
  const pool = useRef<ConversionPool | null>(null);
  const cancelled = useRef(false);

  // A visit that navigates away mid-Batch takes its Workers with it. A Worker
  // holding a 3.3 MB AVIF codec is not something to leave to the garbage
  // collector's timing, and the page it was working for is already gone.
  useEffect(
    () => () => {
      cancelled.current = true;
      pool.current?.terminate();
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelled.current = true;
    pool.current?.terminate();
    pool.current = null;
    setPlanned([]);
    setOutcomes([]);
    setRunning(false);
  }, []);

  /**
   * Empty the results, and nothing else.
   *
   * The button that calls this is hidden while a Batch runs (stopping one is
   * `cancel`), so this never has to touch the pool or the `cancelled` flag: it
   * exists for the visitor who is done reading the download list and wants it
   * gone without adding another file first.
   */
  const clear = useCallback(() => {
    setPlanned([]);
    setOutcomes([]);
  }, []);

  /** Not memoised by its callers: the target formats are read at the click. */
  const start = useCallback(async (files: readonly File[], targets: readonly TargetSettings[]) => {
    const plan = planConversions(
      files.map((file) => file.name),
      targets,
    );
    if (plan.length === 0) return;

    cancelled.current = false;
    setPlanned(plan);
    setOutcomes([]);
    setRunning(true);

    const instance = new ConversionPool();
    pool.current = instance;

    try {
      await instance.run(files, plan, (outcome) => {
        if (cancelled.current) return;
        setOutcomes((previous) => [...previous, outcome]);
      });
    } finally {
      // Whatever happened, the Workers go away and the form becomes usable
      // again — a Batch that fails must not leave the Convert button disabled.
      instance.terminate();
      pool.current = null;
      setRunning(false);
    }
  }, []);

  return { running, planned, outcomes, start, cancel, clear };
}
