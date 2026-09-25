"use client";

import {
  Accordion,
  Box,
  Button,
  ColorInput,
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
import { Dropzone } from "@mantine/dropzone";
import { snapdom } from "@zumer/snapdom";
import { useEffect, useRef, useState } from "react";

import { fontUnreadable, refuseBackgroundImage, refuseFontFile } from "./core/failures";
import { resolveLucideIcon, searchLucide, type LucideSet } from "./core/icons";
import { backgroundTooBig, fontTooBig } from "./core/limits";
import { defaultCoverName, sanitizeFileName, uniqueCoverName } from "./core/naming";
import { pixelCaption, ratioByKey, ratios } from "./core/ratios";
import {
  createDefaultComposition,
  proportionalSizes,
  updateComposition,
  type Composition,
  type CompositionIcon,
  type ShadowScope,
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

/** The one field of a Local Font Access read that this Tool uses. */
type LocalFontRead = { family: string };

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
  const [bgRefusal, setBgRefusal] = useState<string | null>(null);
  const [fontRefusal, setFontRefusal] = useState<string | null>(null);
  const [sysFonts, setSysFonts] = useState<string[]>([]);
  const [sysHint, setSysHint] = useState<string | null>(null);
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
  const textShadow =
    composition.shadowScope === "all" || composition.shadowScope === "text"
      ? `${composition.shadowColor} 0 2px 8px`
      : undefined;
  const iconShadow =
    composition.shadowScope === "all" || composition.shadowScope === "icon"
      ? `drop-shadow(0 2px 8px ${composition.shadowColor})`
      : undefined;
  const iconColor = composition.colorSync ? composition.textColor : composition.iconColor;

  const compositionMarkup = (
    <Box
      style={{
        background: composition.transparent ? "transparent" : composition.bgColor,
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {composition.backgroundImage !== null && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${composition.backgroundImage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: composition.backgroundOpacity,
          }}
        />
      )}
      <Flex
        align="center"
        gap={composition.spacing}
        justify="center"
        style={{ inset: 0, position: "absolute" }}
      >
        <span
          style={{
            color: composition.textColor,
            fontFamily: composition.fontFamily ?? undefined,
            fontSize: composition.fontSize,
            fontWeight: composition.weight,
            textShadow,
          }}
        >
          {composition.leftText}
        </span>
        {composition.iconVisible &&
          composition.icon !== null &&
          (composition.iconBackground ? (
            <Box
              style={{
                background: "var(--mantine-color-default-border)",
                borderRadius: `${composition.iconRadius}%`,
                padding: 16,
              }}
            >
              <span style={{ color: iconColor, filter: iconShadow }}>
                {renderIcon(composition.iconSize)}
              </span>
            </Box>
          ) : (
            <span style={{ color: iconColor, filter: iconShadow }}>
              {renderIcon(composition.iconSize)}
            </span>
          ))}
        <span
          style={{
            color: composition.textColor,
            fontFamily: composition.fontFamily ?? undefined,
            fontSize: composition.fontSize,
            fontWeight: composition.weight,
            textShadow,
          }}
        >
          {composition.rightText}
        </span>
      </Flex>
    </Box>
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
        backgroundColor: composition.transparent ? null : undefined,
      });
      const blob = await result.toBlob({ format: "png" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const base =
        composition.filename.trim() === ""
          ? defaultCoverName(composition.ratioId, composition.leftText, composition.rightText)
          : sanitizeFileName(composition.filename);
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

  function uploadBackground(file: File | null) {
    if (file === null) return;
    if (backgroundTooBig(file.size)) {
      setBgRefusal(refuseBackgroundImage(file.size));
      return;
    }
    if (composition.backgroundImage !== null) URL.revokeObjectURL(composition.backgroundImage);
    setBgRefusal(null);
    set({ backgroundImage: URL.createObjectURL(file) });
  }

  /** Upload a font: bytes → FontFace → document fonts (experiment #57 verified
      the capture path; the browser's parse errors stay in the console). */
  async function uploadFont(file: File | null) {
    if (file === null) return;
    if (fontTooBig(file.size)) {
      setFontRefusal(refuseFontFile(file.size));
      return;
    }
    setFontRefusal(null);
    try {
      const bytes = await file.arrayBuffer();
      const family = sanitizeFileName(file.name.replace(/\.[^.]+$/, "")) || "访客字体";
      const face = new FontFace(family, bytes);
      await face.load();
      document.fonts.add(face);
      set({ fontFamily: family });
    } catch {
      setFontRefusal(fontUnreadable());
    }
  }

  /** Local Font Access, graceful where the API does not exist (Chromium only). */
  async function fetchSystemFonts() {
    const query = (window as Window & { queryLocalFonts?: () => Promise<LocalFontRead[]> })
      .queryLocalFonts;
    if (typeof query !== "function") {
      setSysHint("此浏览器不支持读取系统字体。");
      return;
    }
    try {
      const fonts = await query();
      const families = [...new Set(fonts.map((font) => font.family))];
      // The tsconfig target (ES2022) has no Array#toSorted; the array is a
      // fresh spread, so sorting it mutates nothing shared.
      // oxlint-disable-next-line unicorn/no-array-sort -- see above
      families.sort((a, b) => a.localeCompare(b));
      setSysFonts(families);
      setSysHint(null);
    } catch {
      setSysHint("读取系统字体被拒绝。");
    }
  }

  const iconResults = iconSet === null ? [] : searchLucide(iconSet, iconQuery);

  return (
    <Flex className="items-start" direction={{ base: "column", md: "row" }} gap="lg">
      {/* The configuration column. `order` swaps it under the canvas on a narrow
          screen without a second tree; the accordion is the same component at
          every width. The 样式 section arrives with ticket #59. */}
      <Box className="order-2 w-full md:order-1 md:w-80">
        <Accordion multiple defaultValue={["content", "style", "export"]}>
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

                <Divider />
                <Dropzone
                  accept={["image/*"]}
                  onDrop={(files) => uploadBackground(files[0] ?? null)}
                  p="sm"
                  radius="md"
                >
                  <Text c="dimmed" size="sm" ta="center">
                    拖拽背景图到此处，或点击选择
                  </Text>
                </Dropzone>
                {bgRefusal !== null && (
                  <Text c="red" size="sm">
                    {bgRefusal}
                  </Text>
                )}

                <Divider />
                <FileInput
                  accept=".woff2,.woff,.ttf,.otf"
                  label="上传字体"
                  onChange={uploadFont}
                  placeholder="选择字体文件"
                />
                {fontRefusal !== null && (
                  <Text c="red" size="sm">
                    {fontRefusal}
                  </Text>
                )}
                <Button
                  className="touch-target"
                  color="gray"
                  justify="flex-start"
                  onClick={fetchSystemFonts}
                  variant="subtle"
                >
                  获取系统字体
                </Button>
                {sysHint !== null && (
                  <Text c="dimmed" size="sm">
                    {sysHint}
                  </Text>
                )}
                {sysFonts.length > 0 && (
                  <Stack gap={4} mah={220} style={{ overflowY: "auto" }}>
                    {sysFonts.map((family) => (
                      <Button
                        className="touch-target"
                        color="gray"
                        justify="flex-start"
                        key={family}
                        onClick={() => set({ fontFamily: family })}
                        variant={composition.fontFamily === family ? "light" : "subtle"}
                      >
                        {family}
                      </Button>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="style">
            <Accordion.Control>样式</Accordion.Control>
            <Accordion.Panel>
              <Stack gap="md">
                <Slider
                  label="字体大小"
                  max={256}
                  min={16}
                  onChange={(fontSize) =>
                    set(
                      composition.proportional
                        ? { fontSize, ...proportionalSizes(fontSize) }
                        : { fontSize },
                    )
                  }
                  value={composition.fontSize}
                />
                <Slider
                  label="图标大小"
                  max={256}
                  min={16}
                  onChange={(iconSize) => set({ iconSize })}
                  value={composition.iconSize}
                />
                <Slider
                  label="图标圆角"
                  max={50}
                  min={0}
                  onChange={(iconRadius) => set({ iconRadius })}
                  value={composition.iconRadius}
                />
                <Slider
                  label="间距"
                  max={120}
                  min={0}
                  onChange={(spacing) => set({ spacing })}
                  value={composition.spacing}
                />
                <Switch
                  checked={composition.proportional}
                  label="等比缩放"
                  onChange={(event) => set({ proportional: event.currentTarget.checked })}
                />

                <Divider />
                <Slider
                  label="背景不透明度"
                  max={100}
                  min={0}
                  onChange={(percent) => set({ backgroundOpacity: percent / 100 })}
                  value={Math.round(composition.backgroundOpacity * 100)}
                />
                <Switch
                  checked={composition.colorSync}
                  label="颜色同步"
                  onChange={(event) => set({ colorSync: event.currentTarget.checked })}
                />
                <ColorInput
                  format="hex"
                  label="文字颜色"
                  onChange={(textColor) => set({ textColor })}
                  value={composition.textColor}
                />
                <ColorInput
                  disabled={composition.colorSync}
                  format="hex"
                  label="图标颜色"
                  onChange={(value) => set({ iconColor: value })}
                  value={composition.iconColor}
                />
                <ColorInput
                  format="hex"
                  label="背景颜色"
                  onChange={(bgColor) => set({ bgColor })}
                  value={composition.bgColor}
                />

                <Divider />
                <SegmentedControl
                  data={SHADOW_SCOPES.map((scope) => ({
                    label: SHADOW_LABELS[scope],
                    value: scope,
                  }))}
                  onChange={(value) => {
                    const scope = SHADOW_SCOPES.find((one) => one === value);
                    if (scope !== undefined) set({ shadowScope: scope });
                  }}
                  value={composition.shadowScope}
                />
                <ColorInput
                  format="hex"
                  label="阴影颜色"
                  onChange={(shadowColor) => set({ shadowColor })}
                  value={composition.shadowColor}
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="export">
            <Accordion.Control>导出</Accordion.Control>
            <Accordion.Panel>
              <Flex gap="md" direction="column" align="stretch">
                <TextInput
                  label="文件名"
                  onChange={(event) => set({ filename: event.currentTarget.value })}
                  placeholder="默认按比例与文字生成"
                  value={composition.filename}
                />
                <Switch
                  checked={composition.transparent}
                  label="背景透明（仅 PNG）"
                  onChange={(event) => set({ transparent: event.currentTarget.checked })}
                />
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

/** The shadow scopes, in the order the control shows them. */
const SHADOW_SCOPES: ShadowScope[] = ["all", "text", "icon", "none"];
const SHADOW_LABELS: Record<ShadowScope, string> = {
  all: "全部",
  text: "文字",
  icon: "图标",
  none: "无",
};
