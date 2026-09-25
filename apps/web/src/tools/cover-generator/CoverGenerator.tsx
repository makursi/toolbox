"use client";

import {
  Accordion,
  Box,
  Button,
  Divider,
  FileInput,
  Flex,
  SegmentedControl,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { snapdom } from "@zumer/snapdom";
import { useEffect, useRef, useState } from "react";

import { resolveLucideIcon, searchLucide, type LucideSet } from "./core/icons";
import { defaultCoverName, uniqueCoverName } from "./core/naming";
import { pixelCaption, ratioByKey, ratios } from "./core/ratios";
import {
  createDefaultComposition,
  updateComposition,
  type Composition,
  type CompositionIcon,
} from "./core/state";

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
 * Ticket #54 — the icon system. The lucide set arrives as a same-origin chunk
 * (`@iconify-json/lucide/icons.json`, ~0.6 MB / 1853 icons) loaded once by
 * dynamic import; the search is a pure filter over it, and the composition
 * renders the chosen icon as inline SVG (captured directly by the engine) or as
 * the visitor's own image, which keeps its own colours. Library icons follow
 * the text colour; there is no "original colour" switch — see `rules.md`.
 */
export function CoverGenerator() {
  const [composition, setComposition] = useState<Composition>(createDefaultComposition);
  const [exporting, setExporting] = useState(false);
  const [iconSet, setIconSet] = useState<LucideSet | null>(null);
  const [iconQuery, setIconQuery] = useState("");
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

  /** The lucide chunk, fetched once from this origin. */
  useEffect(() => {
    let live = true;
    void import("@iconify-json/lucide/icons.json").then((module) => {
      if (!live) return;
      setIconSet(module.default);
    });
    return () => {
      live = false;
    };
  }, []);

  const set = (patch: Partial<Composition>) =>
    setComposition((prev) => updateComposition(prev, patch));

  /** The chosen icon at `size`, as inline SVG or the visitor's own image. */
  function renderIcon(size: number) {
    const icon = composition.icon;
    if (icon === null) return null;
    if (icon.source === "upload") {
      // The visitor's own image is a blob: URL the browser minted; next/image
      // has no loader for that, so a plain <img> is the honest element.
      return (
        // oxlint-disable-next-line next/no-img-element -- blob: URL, see above
        <img alt="" src={icon.url} style={{ width: size, height: size, objectFit: "contain" }} />
      );
    }
    const resolved = iconSet === null ? undefined : resolveLucideIcon(iconSet, icon.name);
    if (resolved === undefined) return null;
    return (
      <svg
        aria-hidden
        dangerouslySetInnerHTML={{ __html: resolved.body }}
        fill="none"
        height={size}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox={`0 0 ${resolved.width} ${resolved.height}`}
        width={size}
      />
    );
  }

  /** The composition itself — rendered in both the preview and the export. */
  const compositionMarkup = (
    <Flex align="center" justify="center" gap={20} style={{ height: "100%" }}>
      <span style={{ fontSize: 64, fontWeight: composition.weight }}>{composition.leftText}</span>
      {composition.iconVisible &&
        composition.icon !== null &&
        (composition.iconBackground ? (
          <Box
            style={{
              background: "var(--mantine-color-default-border)",
              borderRadius: 24,
              padding: 16,
            }}
          >
            {renderIcon(64)}
          </Box>
        ) : (
          renderIcon(64)
        ))}
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

  function pickIcon(icon: CompositionIcon) {
    if (composition.icon?.source === "upload" && icon.source !== "upload") {
      URL.revokeObjectURL(composition.icon.url);
    }
    set({ icon });
  }

  function uploadIcon(file: File | null) {
    if (file === null) return;
    if (composition.icon?.source === "upload") URL.revokeObjectURL(composition.icon.url);
    const url = URL.createObjectURL(file);
    set({ icon: { source: "upload", url } });
    setIconQuery("");
  }

  const iconResults = iconSet === null ? [] : searchLucide(iconSet, iconQuery);

  return (
    <Flex className="items-start" direction={{ base: "column", md: "row" }} gap="lg">
      {/* The configuration column. `order` swaps it under the canvas on a narrow
          screen without a second tree; the accordion is the same component at
          every width. The 样式 section arrives with ticket #59. */}
      <Box className="order-2 w-full md:order-1 md:w-80">
        <Accordion multiple defaultValue={["content", "export"]}>
          <Accordion.Item value="content">
            <Accordion.Control>内容</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Flex
                  gap="md"
                  direction={{ base: "column", md: "row" }}
                  align={{ base: "stretch", md: "center" }}
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
                />

                <Divider />
                <Switch
                  checked={composition.iconVisible}
                  label="显示图标"
                  onChange={(event) => set({ iconVisible: event.currentTarget.checked })}
                />
                <Switch
                  checked={composition.iconBackground}
                  label="图标背景"
                  onChange={(event) => set({ iconBackground: event.currentTarget.checked })}
                />
                <FileInput
                  accept="image/*"
                  label="上传图标"
                  onChange={uploadIcon}
                  placeholder="选择图标文件"
                />
                <TextInput
                  label="搜索图标"
                  placeholder="例如 image"
                  value={iconQuery}
                  onChange={(event) => setIconQuery(event.currentTarget.value)}
                />
                {iconSet !== null && iconResults.length > 0 && (
                  <Stack gap={4} mah={220} style={{ overflowY: "auto" }}>
                    {iconResults.map((name) => {
                      const resolved = resolveLucideIcon(iconSet, name);
                      const selected =
                        composition.icon?.source === "lucide" && composition.icon.name === name;
                      return (
                        <Button
                          className="touch-target"
                          color="gray"
                          justify="flex-start"
                          key={name}
                          leftSection={
                            resolved === undefined ? null : (
                              <IconGlyph
                                body={resolved.body}
                                height={resolved.height}
                                size={18}
                                width={resolved.width}
                              />
                            )
                          }
                          onClick={() => pickIcon({ source: "lucide", name })}
                          variant={selected ? "light" : "subtle"}
                        >
                          {name}
                        </Button>
                      );
                    })}
                  </Stack>
                )}
                {iconQuery.trim() !== "" && iconResults.length === 0 && (
                  <Text c="dimmed" size="sm">
                    没有匹配的图标。
                  </Text>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="export">
            <Accordion.Control>导出</Accordion.Control>
            <Accordion.Panel>
              <Flex gap="md" direction="column" align="stretch">
                <SegmentedControl
                  data={ratios.map((r) => ({ label: r.key, value: r.key }))}
                  value={composition.ratioId}
                  onChange={(ratioId) => set({ ratioId })}
                />
                <Button className="touch-target" loading={exporting} onClick={exportCover}>
                  下载 {composition.ratioId}
                </Button>
              </Flex>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Box>

      {/* The canvas column: pinned on a narrow screen so the composition stays
          in view while the configuration column scrolls beneath it. */}
      <Box className="order-1 min-w-0 flex-1 md:order-2">
        <div className="sticky top-4">
          {/* The preview: the full-size composition, scaled to fit the pane. The
              badge and the pixel caption sit here, not in the export. */}
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
        </div>
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
    </Flex>
  );
}

/** A library icon as a small inline SVG, for a result row. */
function IconGlyph({
  body,
  height,
  size,
  width,
}: {
  body: string;
  height: number;
  size: number;
  width: number;
}) {
  return (
    <svg
      aria-hidden
      dangerouslySetInnerHTML={{ __html: body }}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeWidth={2}
      viewBox={`0 0 ${width} ${height}`}
      width={size}
    />
  );
}
