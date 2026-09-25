"use client";

import { Box, Button, Flex, SegmentedControl, Slider, Stack, Text, TextInput } from "@mantine/core";
import { snapdom } from "@zumer/snapdom";
import { useEffect, useRef, useState } from "react";

import { defaultCoverName, uniqueCoverName } from "./core/naming";
import { pixelCaption, ratioByKey, ratios } from "./core/ratios";
import { createDefaultComposition, updateComposition, type Composition } from "./core/state";

/**
 * Keeps `onFit` current with how an element's width compares to a fixed width,
 * and returns a stop function. Lives at module scope so the effect's return
 * value is one shape on every path.
 */
function observeFit(el: HTMLElement, ratioWidth: number, onFit: (fit: number) => void): () => void {
  const update = () => onFit(el.clientWidth / ratioWidth);
  update();
  const observer = new ResizeObserver(update);
  observer.observe(el);
  return () => observer.disconnect();
}

/**
 * Ticket #52 — the composition tracer: the state model, the live preview, and
 * the PNG export, end to end. The editor chrome is deliberately plain here —
 * the ThisCover-style layout (left column + canvas) is ticket #53.
 *
 * Preview = export by construction: one element shows the composition scaled to
 * fit the pane, a second, offscreen element renders the same composition at the
 * ratio's full pixel size, and the export captures that second instance. What
 * the visitor sees and what the file contains are the same DOM.
 */
export function CoverGenerator() {
  const [composition, setComposition] = useState<Composition>(createDefaultComposition);
  const [exporting, setExporting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState(1);

  const ratio = ratioByKey(composition.ratioId) ?? ratios[2];

  /** Scale the full-size composition down to the pane's width. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (el === null) return () => undefined;
    return observeFit(el, ratio.width, setFit);
  }, [ratio.width]);

  const set = (patch: Partial<Composition>) =>
    setComposition((prev) => updateComposition(prev, patch));

  /** The composition itself — rendered in both the preview and the export. */
  const compositionMarkup = (
    <Flex align="center" justify="center" gap={20} style={{ height: "100%" }}>
      <span style={{ fontSize: 64, fontWeight: composition.weight }}>{composition.leftText}</span>
      <span style={{ fontSize: 64, fontWeight: composition.weight }}>{composition.rightText}</span>
    </Flex>
  );

  async function exportCover() {
    const element = exportRef.current;
    if (element === null) return;
    setExporting(true);
    try {
      const result = await snapdom(element, {
        width: ratio.width,
        height: ratio.height,
        format: "png",
      });
      const blob = await result.toBlob({ format: "png" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const base = defaultCoverName(
        composition.ratioId,
        composition.leftText,
        composition.rightText,
      );
      anchor.href = url;
      anchor.download = `${uniqueCoverName(base, new Set())}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <Stack className="mt-10 sm:mt-12" gap="md">
      <Stack gap="xs">
        <Text fw={500} size="sm">
          内容
        </Text>
        <Flex
          gap="md"
          direction={{ base: "column", sm: "row" }}
          align={{ base: "stretch", sm: "center" }}
        >
          <TextInput
            label="左侧文字"
            value={composition.leftText}
            onChange={(event) => set({ leftText: event.currentTarget.value })}
          />
          <TextInput
            label="右侧文字"
            value={composition.rightText}
            onChange={(event) => set({ rightText: event.currentTarget.value })}
          />
        </Flex>
        <Slider
          label="字重"
          min={100}
          max={900}
          step={100}
          value={composition.weight}
          onChange={(weight) => set({ weight })}
          w={{ base: "100%", sm: 220 }}
        />
      </Stack>

      {/* The preview: the full-size composition, scaled to fit the pane. The
          badge and the pixel caption sit on the wrapper, not in the export. */}
      <Box
        ref={wrapperRef}
        className="relative w-full overflow-hidden rounded-md border border-[var(--mantine-color-default-border)] bg-white"
        style={{ aspectRatio: `${ratio.width} / ${ratio.height}` }}
      >
        <div
          style={{
            width: ratio.width,
            height: ratio.height,
            transform: `scale(${fit})`,
            transformOrigin: "top left",
          }}
        >
          {compositionMarkup}
        </div>
        <span
          className="absolute top-2 left-2 text-sm text-[var(--mantine-color-dimmed)]"
          aria-hidden
        >
          {composition.ratioId} · {pixelCaption(composition.ratioId)}
        </span>
      </Box>

      {/* The export instance: the same composition at full size, off screen. */}
      <div
        ref={exportRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -100000,
          top: 0,
          width: ratio.width,
          height: ratio.height,
          background: "#ffffff",
        }}
      >
        {compositionMarkup}
      </div>

      <Flex gap="md" align="center">
        <SegmentedControl
          data={ratios.map((r) => ({ label: r.key, value: r.key }))}
          value={composition.ratioId}
          onChange={(ratioId) => set({ ratioId })}
        />
        <Button className="touch-target" loading={exporting} onClick={exportCover} variant="filled">
          下载 {composition.ratioId}
        </Button>
      </Flex>
    </Stack>
  );
}
