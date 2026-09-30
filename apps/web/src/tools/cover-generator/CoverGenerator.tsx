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
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useRef } from "react";

import { CompositionCanvas } from "./composition-canvas/composition-canvas";
import { matchesFont } from "./core/fonts";
import { resolveLucideIcon } from "./core/icons";
import { pixelCaption, ratioByKey, ratios } from "./core/ratios";
import { EXPORT_SCALES, proportionalSizes, type ShadowScope } from "./core/state";
import { useCoverComposition } from "./hooks/use-cover-composition/use-cover-composition";
import { useCoverExport } from "./hooks/use-cover-export/use-cover-export";
import { useCoverFonts } from "./hooks/use-cover-fonts/use-cover-fonts";
import { useFitScale } from "./hooks/use-fit-scale/use-fit-scale";
import { useLucideIcons } from "./hooks/use-lucide-icons/use-lucide-icons";
import { readAsDataUrl } from "./read-data-url";

/**
 * The Cover Generator: compose two texts around a centre icon on a background,
 * at one of four ratios, and download it as a PNG.
 *
 * The state lives in five single-responsibility hooks (composition, export,
 * icons, fonts, fit) and the composition itself is one component shared by the
 * preview and the off-screen export. This component is the editor: it wires the
 * hooks to the controls and bridges the read-side hooks back into the
 * composition through `set`.
 */
export function CoverGenerator() {
  const { composition, set, bgRefusal, uploadBackground, clearBackground } = useCoverComposition();
  const { iconSet, iconQuery, setIconQuery, results: iconResults } = useLucideIcons();
  const { fontRefusal, sysFonts, sysHint, uploadFont, fetchSystemFonts } = useCoverFonts();
  const ratio = ratioByKey(composition.ratioId) ?? ratios[2];
  const { fit, wrapperRef } = useFitScale(ratio.width);
  const exportRef = useRef<HTMLDivElement | null>(null);
  const { exportCover, exporting } = useCoverExport(exportRef, composition, ratio);

  async function uploadIcon(file: File | null) {
    if (file === null) return;
    const url = await readAsDataUrl(file);
    set({ icon: { source: "upload", url } });
    setIconQuery("");
  }

  async function onUploadFont(file: File | null) {
    const family = await uploadFont(file);
    if (family !== null) set({ fontFamily: family });
  }

  return (
    <Flex
      align={{ base: "stretch", sm: "flex-start" }}
      direction={{ base: "column", sm: "row" }}
      gap="lg"
    >
      {/* The configuration column. `order` swaps it under the canvas on a narrow
          screen without a second tree; the accordion is the same component at
          every width.

          The swap is the one property Mantine has no style prop for, so it stays
          a Tailwind class: Tailwind's `md` is 48rem and Mantine's `sm` is 48em,
          which is the same 768px, so both sides of the layout flip together. A
          Tailwind `sm:` would have flipped at 640 and split them, which is the
          band this tool shipped broken (#80). */}
      <Box className="cover-editor-column order-2 md:order-1" w={{ base: "100%", sm: 320 }}>
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
                  thumbLabel="字重"
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
                          className="touch-target shrink-0"
                          color="gray"
                          h={44}
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
                          onClick={() => set({ icon: { source: "lucide", name } })}
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
                {composition.backgroundImage !== null && (
                  <Button
                    className="touch-target"
                    color="gray"
                    onClick={clearBackground}
                    variant="subtle"
                  >
                    清除
                  </Button>
                )}

                <Divider />
                <FileInput
                  accept=".woff2,.woff,.ttf,.otf"
                  label="上传字体"
                  onChange={onUploadFont}
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
                <Select
                  searchable
                  data={sysFonts}
                  disabled={sysFonts.length === 0}
                  filter={(input) =>
                    input.options.filter(
                      (option) => "value" in option && matchesFont(option.value, input.search),
                    )
                  }
                  label="系统字体"
                  maxDropdownHeight={220}
                  nothingFoundMessage="没有匹配的字体"
                  onChange={(family) => {
                    if (family !== null) set({ fontFamily: family });
                  }}
                  placeholder={sysFonts.length === 0 ? "先获取系统字体" : "搜索字体"}
                  value={
                    composition.fontFamily !== null && sysFonts.includes(composition.fontFamily)
                      ? composition.fontFamily
                      : null
                  }
                />
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
                  thumbLabel="字体大小"
                  value={composition.fontSize}
                />
                <Slider
                  label="图标大小"
                  max={256}
                  min={16}
                  onChange={(iconSize) => set({ iconSize })}
                  thumbLabel="图标大小"
                  value={composition.iconSize}
                />
                <Slider
                  label="图标圆角"
                  max={50}
                  min={0}
                  onChange={(iconRadius) => set({ iconRadius })}
                  thumbLabel="图标圆角"
                  value={composition.iconRadius}
                />
                <Slider
                  label="间距"
                  max={120}
                  min={0}
                  onChange={(spacing) => set({ spacing })}
                  thumbLabel="间距"
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
                  thumbLabel="背景不透明度"
                  value={Math.round(composition.backgroundOpacity * 100)}
                />
                <Slider
                  disabled={composition.backgroundImage === null || composition.transparent}
                  label="背景模糊"
                  max={100}
                  min={0}
                  onChange={(backgroundBlur) => set({ backgroundBlur })}
                  step={1}
                  thumbLabel="背景模糊"
                  value={composition.backgroundBlur}
                />
                <Slider
                  disabled={composition.backgroundImage === null || composition.transparent}
                  label="背景灰度"
                  max={100}
                  min={0}
                  onChange={(backgroundGrayscale) => set({ backgroundGrayscale })}
                  step={1}
                  thumbLabel="背景灰度"
                  value={composition.backgroundGrayscale}
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
                <Text c="dimmed" size="sm">
                  导出缩放
                </Text>
                <SegmentedControl
                  data={EXPORT_SCALES.map((scale) => ({
                    label: `${scale}x`,
                    value: String(scale),
                  }))}
                  value={String(composition.exportScale)}
                  onChange={(value) => {
                    const scale = EXPORT_SCALES.find((one) => String(one) === value);
                    if (scale !== undefined) set({ exportScale: scale });
                  }}
                />
                <Button className="touch-target" loading={exporting} onClick={exportCover}>
                  下载 {composition.ratioId}
                  {composition.exportScale > 1 ? ` @${composition.exportScale}x` : ""}
                </Button>
              </Flex>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Box>

      {/* The canvas column: pinned on a narrow screen so the composition stays
          in view while the configuration column scrolls beneath it. */}
      <Box className="cover-canvas-column order-1 min-w-0 flex-1 md:order-2">
        <div className="sticky top-4">
          {/* The preview: the full-size composition, scaled to fit the pane. The
              badge and the pixel caption sit here, not in the export. */}
          <Box
            ref={wrapperRef}
            className="relative w-full overflow-hidden rounded-md border border-[var(--mantine-color-default-border)] bg-white"
            style={{ aspectRatio: `${ratio.width} / ${ratio.height}` }}
          >
            {/* The composition is a fixed 1280×720 box, so it sits out of the
                layout flow: a `w-full` pane whose child is 1280px wide has an
                intrinsic width of 1280, and any slip in the breakpoints above it
                used to let that inflate the column and draw the preview at 1:1
                (#80). The pane's height comes from its own aspect ratio. */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: ratio.width,
                height: ratio.height,
                transform: `scale(${fit})`,
                transformOrigin: "top left",
              }}
            >
              <CompositionCanvas composition={composition} iconSet={iconSet} />
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
        <CompositionCanvas composition={composition} iconSet={iconSet} />
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
