"use client";

import {
  Box,
  Button,
  Divider,
  FileInput,
  Flex,
  Select,
  Slider,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { Dropzone } from "@mantine/dropzone";
import { useRef, type CSSProperties, type ReactNode } from "react";

/*
 * The incoming component layer's parts of this page (#117). `Button` and `Switch`
 * are aliased because the outgoing layer's `Button` and `Switch` are still used by
 * the two sections that have not moved: during the two-layer state the alias is
 * what makes it obvious which layer a line belongs to, and it disappears with the
 * last section.
 */
import { Button as PrimitiveButton } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch as PrimitiveSwitch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
/**
 * A label and the control it names, in the arrangement the 样式 panel uses.
 *
 * Every control in that panel is a **native element rather than a Primitive**, and
 * the reason is measured rather than preferred (#128). The incoming layer's
 * `Slider` renders its own thumb and passes it no props, and Radix's thumb falls
 * back to `getLabel(index, totalValues)` — which returns `undefined` for a single
 * thumb, so a one-value slider ships with **no accessible name at all**
 * (`@radix-ui/react-slider`'s `SliderThumbTrigger`, read on 2026-10-05). This repo
 * already decided once that a slider's name has to be supplied explicitly; the
 * platform takes it from a `<label for>`, which is this Tool's own visible copy,
 * and it also supplies the keyboard, the pointer drag and the disabled state
 * without a second implementation of any of them. The Primitive generated for the
 * job was removed rather than left standing unused.
 *
 * `input[type=range]` and `input[type=color]` are replaced elements and paint no
 * `::after`, so their 44px comes from `h-11` and the hit-area class on them is the
 * Instrument's marker rather than an overlay — the same finding the export panel's
 * filename field carries (`apps/web/docs/design/components.md`).
 */
function Field({
  children,
  htmlFor,
  label,
}: {
  children: ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

export function CoverGenerator() {
  const { composition, set, bgRefusal, uploadBackground, clearBackground } = useCoverComposition();
  const { iconSet, iconQuery, setIconQuery, results: iconResults } = useLucideIcons();
  const { fontRefusal, sysFonts, sysHint, uploadFont, fetchSystemFonts } = useCoverFonts();
  const ratio = ratioByKey(composition.ratioId) ?? ratios[2];
  const { fit, paneHeight, wrapperRef } = useFitScale(ratio.width);
  // The pane's shape, in one number. `aspectRatio` is what gets drawn; the same
  // number goes to the stylesheet as a custom property, because the narrow-screen
  // cap there has to turn a maximum height into a maximum width
  // (`.cover-preview-pane` in `globals.css`).
  const aspect = ratio.width / ratio.height;
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
      <Box
        className="cover-editor-column order-2 md:order-1"
        data-slot="cover-editor-column"
        w={{ base: "100%", sm: 320 }}
      >
        {/* The three sections as a tab row, the same behaviour at every width
            (#91): a second behaviour per width is what `ADR-0010` rejected, and a
            narrow screen is where this one earns its keep.

            Since #117 this is the incoming component layer's `Tabs`, and the
            unpicked panels are **unmounted** — not the element hidden, the element
            gone. That is what the sentence above always meant and what the outgoing
            library only half did (it kept every panel element in the DOM and hid it
            inline, while `keepMounted={false}` kept the *contents* out). It is also
            the thing `touch-targets.mjs` reads: its `presence` claim asks whether a
            panel is *showing*, so an unmounted one answers 0 rather than lying.
            `ui-fingerprint.mjs` therefore declares only the panel that exists in the
            default state as an anchor — the three are mutually exclusive by design,
            and each is covered by the Instrument, which opens all three. */}
        <Tabs
          className="cover-tabs"
          data-slot="cover-tabs"
          defaultValue="content"
          style={{ "--cover-preview-height": `${paneHeight}px` } as CSSProperties}
        >
          {/* `variant="line"` rather than the registry's default: the default marks
              the active tab with a filled pill and `shadow-sm`, and a resting shadow
              is a position this site has taken (`apps/web/docs/design/colour.md`).
              `line` marks it with a 2px bar in the foreground colour, which is what
              the outgoing layer's underline already was. */}
          {/* `h-auto` because the registry's list is a fixed `h-9` (36px) while this
              site's tabs owe a finger 46px: without it the tabs would draw outside
              the row that is supposed to be their background. The class is written
              with the same variant the registry's height carries — the variant
              prefix is part of the utility's identity, so a bare `h-auto` would sit
              beside `h-9` rather than replace it, and `cn` is what makes it a
              replacement. */}
          <TabsList
            className="w-full group-data-[orientation=horizontal]/tabs:h-auto"
            data-slot="cover-tab-row"
            variant="line"
          >
            <TabsTrigger className="touch-target" data-slot="cover-tab" value="content">
              内容
            </TabsTrigger>
            <TabsTrigger className="touch-target" data-slot="cover-tab" value="style">
              样式
            </TabsTrigger>
            <TabsTrigger className="touch-target" data-slot="cover-tab" value="export">
              导出
            </TabsTrigger>
          </TabsList>

          <TabsContent
            className="cover-panel-content"
            data-slot="cover-panel-content"
            value="content"
          >
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
                        className="cover-icon-option touch-target shrink-0"
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
          </TabsContent>

          <TabsContent
            className="cover-panel-style"
            data-layer="primitive"
            data-slot="cover-panel-style"
            value="style"
          >
            {/* `gap-6` for the reason 导出 spells out: a `.touch-target` overlay
                reaches beyond its own box, and the 18px switch needs 18.8px between
                itself and the next control or the walk reads the smaller of the two
                (`apps/web/src/app/globals.css`). */}
            <div className="flex flex-col gap-6">
              <Field htmlFor="cover-font-size" label="字体大小">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-font-size"
                  max={256}
                  min={16}
                  onChange={(event) => {
                    const fontSize = Number(event.currentTarget.value);
                    set(
                      composition.proportional
                        ? { fontSize, ...proportionalSizes(fontSize) }
                        : { fontSize },
                    );
                  }}
                  type="range"
                  value={composition.fontSize}
                />
              </Field>
              <Field htmlFor="cover-icon-size" label="图标大小">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-icon-size"
                  max={256}
                  min={16}
                  onChange={(event) => set({ iconSize: Number(event.currentTarget.value) })}
                  type="range"
                  value={composition.iconSize}
                />
              </Field>
              <Field htmlFor="cover-icon-radius" label="图标圆角">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-icon-radius"
                  max={50}
                  min={0}
                  onChange={(event) => set({ iconRadius: Number(event.currentTarget.value) })}
                  type="range"
                  value={composition.iconRadius}
                />
              </Field>
              <Field htmlFor="cover-spacing" label="间距">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-spacing"
                  max={120}
                  min={0}
                  onChange={(event) => set({ spacing: Number(event.currentTarget.value) })}
                  type="range"
                  value={composition.spacing}
                />
              </Field>
              <div className="flex items-center gap-2">
                <PrimitiveSwitch
                  checked={composition.proportional}
                  className="cover-field touch-target"
                  id="cover-proportional"
                  onCheckedChange={(proportional) => set({ proportional })}
                />
                <Label htmlFor="cover-proportional">等比缩放</Label>
              </div>

              <hr className="border-t border-[var(--site-hairline)]" />
              <Field htmlFor="cover-background-opacity" label="背景不透明度">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-background-opacity"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    set({ backgroundOpacity: Number(event.currentTarget.value) / 100 })
                  }
                  type="range"
                  value={Math.round(composition.backgroundOpacity * 100)}
                />
              </Field>
              <Field htmlFor="cover-background-blur" label="背景模糊">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  disabled={composition.backgroundImage === null || composition.transparent}
                  id="cover-background-blur"
                  max={100}
                  min={0}
                  onChange={(event) => set({ backgroundBlur: Number(event.currentTarget.value) })}
                  step={1}
                  type="range"
                  value={composition.backgroundBlur}
                />
              </Field>
              <Field htmlFor="cover-background-grayscale" label="背景灰度">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  disabled={composition.backgroundImage === null || composition.transparent}
                  id="cover-background-grayscale"
                  max={100}
                  min={0}
                  onChange={(event) =>
                    set({ backgroundGrayscale: Number(event.currentTarget.value) })
                  }
                  step={1}
                  type="range"
                  value={composition.backgroundGrayscale}
                />
              </Field>
              <div className="flex items-center gap-2">
                <PrimitiveSwitch
                  checked={composition.colorSync}
                  className="cover-field touch-target"
                  id="cover-color-sync"
                  onCheckedChange={(colorSync) => set({ colorSync })}
                />
                <Label htmlFor="cover-color-sync">颜色同步</Label>
              </div>
              {/* A colour field is the composed cover's own colour, not the
                  interface's, so the swatch is allowed to be any colour at all —
                  the same exception the cover frames and the thumbnails already
                  have (`apps/web/docs/design/colour.md`). */}
              <Field htmlFor="cover-text-color" label="文字颜色">
                <input
                  className="cover-field touch-target h-11 w-full"
                  id="cover-text-color"
                  onChange={(event) => set({ textColor: event.currentTarget.value })}
                  type="color"
                  value={composition.textColor}
                />
              </Field>
              <Field htmlFor="cover-icon-color" label="图标颜色">
                <input
                  className="cover-field touch-target h-11 w-full"
                  disabled={composition.colorSync}
                  id="cover-icon-color"
                  onChange={(event) => set({ iconColor: event.currentTarget.value })}
                  type="color"
                  value={composition.iconColor}
                />
              </Field>
              <Field htmlFor="cover-background-color" label="背景颜色">
                <input
                  className="cover-field touch-target h-11 w-full"
                  id="cover-background-color"
                  onChange={(event) => set({ bgColor: event.currentTarget.value })}
                  type="color"
                  value={composition.bgColor}
                />
              </Field>

              <hr className="border-t border-[var(--site-hairline)]" />
              <ToggleGroup
                aria-label="阴影范围"
                className="w-full"
                onValueChange={(value) => {
                  const scope = SHADOW_SCOPES.find((one) => one === value);
                  if (scope !== undefined) set({ shadowScope: scope });
                }}
                type="single"
                value={composition.shadowScope}
                variant="outline"
              >
                {SHADOW_SCOPES.map((scope) => (
                  <ToggleGroupItem className="touch-target flex-1" key={scope} value={scope}>
                    {SHADOW_LABELS[scope]}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Field htmlFor="cover-shadow-color" label="阴影颜色">
                <input
                  className="cover-field touch-target h-11 w-full"
                  id="cover-shadow-color"
                  onChange={(event) => set({ shadowColor: event.currentTarget.value })}
                  type="color"
                  value={composition.shadowColor}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent
            className="cover-panel-export"
            data-layer="primitive"
            data-slot="cover-panel-export"
            value="export"
          >
            {/* Laid out with Tailwind utilities rather than the outgoing library's
                `Stack` and `Flex`, so that nothing in this section comes from the
                layer it is leaving.

                `gap-6` rather than a tighter rhythm, and it is arithmetic rather
                than taste: every control here carries `.touch-target`, whose overlay
                is centred and 46px on both axes (44 plus the two pixels #91's
                whole-pixel sampling needs). An overlay reaches
                `(46 - box) / 2` beyond its own box, so two neighbours must be at
                least the sum of their two overhangs apart or one eats the other's
                outer sample points and the walk — which requires *both* sides —
                reports the smaller of the two. The demanding pair here is the 18px
                switch and the 36px ratio row: 13.8 + 5 = 18.8px, measured at 16px
                gaps as `hit-testable 45x37`, which is a failure this Instrument
                exists to report rather than a number to explain away. */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cover-filename">文件名</Label>
                {/* `h-11` (44px) rather than the registry's `h-9`: an `<input>` is a
                    replaced element, so it paints no `::after` at all — the class
                    below is then only the Instrument's way of seeing this control,
                    and the 44px has to come from the layout. Measured: with the
                    registry's 36px the hit area read 35, whatever the pseudo-element
                    declared. */}
                <Input
                  className="touch-target h-11"
                  id="cover-filename"
                  onChange={(event) => set({ filename: event.currentTarget.value })}
                  placeholder="默认按比例与文字生成"
                  value={composition.filename}
                />
              </div>
              {/* Radix's `Switch` is a real `<button role="switch">`, so the hit-area
                  class sits on the element that owns the click — the trap this repo
                  paid for once is a switch whose toggle lives on an inner input under
                  a wrapper that handles nothing, and there is no such wrapper here. */}
              <div className="flex items-center gap-2">
                <PrimitiveSwitch
                  checked={composition.transparent}
                  className="touch-target"
                  id="cover-transparent"
                  onCheckedChange={(transparent) => set({ transparent })}
                />
                <Label htmlFor="cover-transparent">背景透明（仅 PNG）</Label>
              </div>
              {/* The ratio row had no accessible name on the outgoing layer either —
                  a `SegmentedControl` is a group, and a group without a name is read
                  as one; naming it is a repair, not a regression. */}
              <ToggleGroup
                aria-label="比例"
                className="w-full"
                onValueChange={(ratioId) => {
                  if (ratioId !== "") set({ ratioId });
                }}
                type="single"
                value={composition.ratioId}
                variant="outline"
              >
                {ratios.map((one) => (
                  <ToggleGroupItem className="touch-target flex-1" key={one.key} value={one.key}>
                    {one.key}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex flex-col gap-2">
                <span className="text-sm leading-none font-medium" id="cover-scale-label">
                  导出缩放
                </span>
                <ToggleGroup
                  aria-labelledby="cover-scale-label"
                  className="w-full"
                  onValueChange={(value) => {
                    const scale = EXPORT_SCALES.find((one) => String(one) === value);
                    if (scale !== undefined) set({ exportScale: scale });
                  }}
                  type="single"
                  value={String(composition.exportScale)}
                  variant="outline"
                >
                  {EXPORT_SCALES.map((scale) => (
                    <ToggleGroupItem
                      className="touch-target flex-1"
                      key={scale}
                      value={String(scale)}
                    >
                      {scale}x
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              {/* The outgoing layer's `loading` showed a spinner and set `disabled`.
                  The incoming layer's `Button` has no such prop, so the disabled look
                  is what says "working" — recorded in the round rather than papered
                  over with a second animation this site's motion rules would then owe
                  a reason for. */}
              <PrimitiveButton className="touch-target" disabled={exporting} onClick={exportCover}>
                下载 {composition.ratioId}
                {composition.exportScale > 1 ? ` @${composition.exportScale}x` : ""}
              </PrimitiveButton>
            </div>
          </TabsContent>
        </Tabs>
      </Box>

      {/* The canvas column, and it is the sticky element itself rather than the pane
          inside it. A sticky box can only travel inside its own containing block: the
          inner wrapper's parent was the column, which is exactly as tall as the pane,
          so it never moved at all — the preview scrolled away like a static box
          (measured 2026-09-30, recorded in `rules.md`). On the column the containing
          block is the Flex spanning both columns, so the preview really does stay in
          view while the settings scroll beneath it — hence the z-index, since it
          overlays the column that follows it on a narrow screen. */}
      <Box
        className="cover-canvas-column sticky top-4 z-[2] order-1 min-w-0 flex-1 md:order-2"
        data-slot="cover-canvas-column"
      >
        {/* The preview: the full-size composition, scaled to fit the pane. The
            badge and the pixel caption sit here, not in the export. */}
        <Box
          ref={wrapperRef}
          className="cover-preview-pane relative w-full overflow-hidden rounded-md border border-[var(--mantine-color-default-border)] bg-white"
          data-slot="cover-preview-pane"
          style={{ "--cover-aspect": aspect, aspectRatio: aspect } as CSSProperties}
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
