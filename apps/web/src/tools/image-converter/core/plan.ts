import { formatSpecs, type ImageFormat } from "./formats";
import { outputFileName } from "./naming";

/** One file going to one target format. A source with two targets plans twice. */
export type PlannedConversion = {
  id: number;
  sourceIndex: number;
  sourceName: string;
  /** The format this Conversion is encoded to; there is nothing else to set. */
  format: ImageFormat;
  outputName: string;
};

/**
 * Decide what a Batch will produce, before any work starts.
 *
 * Pure on purpose — no Worker, no DOM — because the output names are the part
 * users notice, and they are settled by the collision rule in `naming.ts`
 * rather than by whichever Conversion happens to finish first.
 */
export function planConversions(
  sourceNames: readonly string[],
  formats: readonly ImageFormat[],
): PlannedConversion[] {
  const taken = new Set<string>();
  const planned: PlannedConversion[] = [];

  sourceNames.forEach((sourceName, sourceIndex) => {
    for (const format of formats) {
      const outputName = outputFileName(sourceName, formatSpecs[format].extension, taken);
      taken.add(outputName.toLowerCase());
      planned.push({ id: planned.length, sourceIndex, sourceName, format, outputName });
    }
  });

  return planned;
}
