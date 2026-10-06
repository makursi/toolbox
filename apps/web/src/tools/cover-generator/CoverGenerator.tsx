"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";

/*
 * The incoming component layer's parts of this page (#117). `Button` is aliased
 * because the outgoing layer's `Button` is still used by the parts of 内容 that have
 * not moved — the icon result rows and the background's 清除 — so during the
 * two-layer state the alias is what makes it obvious which layer a line belongs to,
 * and it disappears with the last of them. `Switch` was aliased for the same reason
 * until #129 moved the last one this page had, and `FileInput`, `TextInput`,
 * `Select` and `Dropzone` left the import list with #130.
 */
import { Button as PrimitiveButton } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
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

  /*
   * A disabled control has to say which step is missing, and the sentence has to
   * change with the state rather than being one generic line
   * (`apps/web/docs/design/components.md`). Two states disable the background
   * sliders and they are different missing steps, so they read differently; the
   * colour field has one.
   *
   * These were owed by #128's batch, which moved the controls without their
   * sentences: the rule is site-wide and the controls are on the page either way,
   * so this pays the debt rather than passing it to the round's record.
   *
   * The copy is inline because this Tool's strings already live in this component
   * (文件名, 背景透明（仅 PNG）, 导出缩放, 下载), and this round's own scope forbids
   * touching `core/` and its tests — so the copy module the rule asks for, with the
   * unit tests that hold it, is recorded as owed to #119's consistency pass rather
   * than invented here.
   */
  const backgroundProcessingReason = composition.transparent
    ? "「背景透明」打开时不处理背景图，先关掉它。"
    : composition.backgroundImage === null
      ? "先加一张背景图，模糊与灰度才有作用。"
      : null;
  const iconColorReason = composition.colorSync
    ? "「颜色同步」打开时，图标颜色跟随文字颜色。"
    : null;

  /*
   * The font picker's own state: whether its list is open, and the query the Tool's
   * pure filter (`matchesFont`, `core/fonts.ts`) reads. The filter is deliberately
   * ours rather than the registry's fuzzy match — the rule for what "matches" means
   * is this Tool's, and it is unit-tested there.
   */
  const [fontPickerOpen, setFontPickerOpen] = useState(false);
  const [fontQuery, setFontQuery] = useState("");
  const fontSearchRef = useRef<HTMLInputElement | null>(null);
  const chosenFont =
    composition.fontFamily !== null && sysFonts.includes(composition.fontFamily)
      ? composition.fontFamily
      : null;
  const filteredFonts = sysFonts.filter((family) => matchesFont(family, fontQuery));

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
    /* The two columns. This was the outgoing layer's `Flex`, and its three props
       become three utilities: `gap="lg"` is this site's 20px (Mantine's `lg` is
       `1.25rem`, which is not Tailwind's `lg` either), the direction flips at 768,
       and the cross-axis alignment is `stretch` below that and `flex-start` above it.

       The flip point is Tailwind's `md` (48rem) and not its `sm` (40rem), which is
       the band this tool shipped broken (#80): the outgoing layer's `sm` is 48em,
       the same 768 as the order swap below, and `sm:flex-row` would have flipped the
       columns 128 pixels earlier, splitting the layout from the swap. */
    <div className="flex flex-col gap-5 md:flex-row md:items-start">
      {/* The configuration column. `order` swaps it under the canvas on a narrow
          screen without a second tree; the accordion is the same component at
          every width.

          Both halves of the layout flip at 768 — the direction above and this swap
          — which is the whole reason the class is `md:` rather than `sm:`. The
          outgoing layer spelled 768 `sm` (48em) and Tailwind spells 640 `sm`
          (40rem), so the names disagree about the same word; the numbers are what
          have to agree, and a `sm:` here would have opened a 128px band where the
          columns stack but the swap has not happened (#80, and
          `apps/web/docs/design/layout.md`). */}
      <div
        className="cover-editor-column order-2 w-full md:order-1 md:w-[320px]"
        data-slot="cover-editor-column"
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
            <div className="flex flex-col gap-4">
              {/* The two fields sit side by side from the same width the outgoing
                  layer switched at — its `md` is 992px, and Tailwind's `lg` is the
                  nearest whole breakpoint — and stack below it. */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Field htmlFor="cover-left-text" label="左侧文字">
                  <Input
                    className="cover-field touch-target h-11"
                    id="cover-left-text"
                    onChange={(event) => set({ leftText: event.currentTarget.value })}
                    value={composition.leftText}
                  />
                </Field>
                <Field htmlFor="cover-right-text" label="右侧文字">
                  <Input
                    className="cover-field touch-target h-11"
                    id="cover-right-text"
                    onChange={(event) => set({ rightText: event.currentTarget.value })}
                    value={composition.rightText}
                  />
                </Field>
              </div>
              {/* The weight is a native range for the reason #128 measured and
                  recorded: the incoming layer's `Slider` renders its own thumb and
                  gives it no name, so a named slider cannot be built from it. */}
              <Field htmlFor="cover-weight" label="字重">
                <input
                  className="cover-field touch-target h-11 w-full accent-[var(--site-text)]"
                  id="cover-weight"
                  max={900}
                  min={100}
                  onChange={(event) => set({ weight: Number(event.currentTarget.value) })}
                  step={100}
                  type="range"
                  value={composition.weight}
                />
              </Field>

              <hr className="border-t border-[var(--site-hairline)]" />
              {/* `gap-8` between the two switch rows rather than the panel's own
                  rhythm, and it is arithmetic: a `.touch-target` overlay reaches
                  `(overlay - box) / 2` beyond its own box, so two 18px switches need
                  28px between them or each takes the other's outer sample points.
                  Measured at the panel's 16px as `hit-testable 43x23` — the Instrument
                  reporting a real encroachment, which is the failure it exists for,
                  rather than a number to explain away. */}
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-2">
                  <PrimitiveSwitch
                    checked={composition.iconVisible}
                    className="cover-field touch-target"
                    id="cover-icon-visible"
                    onCheckedChange={(iconVisible) => set({ iconVisible })}
                  />
                  <Label htmlFor="cover-icon-visible">显示图标</Label>
                </div>
                {/* 图标背景 comes with 显示图标 rather than with the icon batches:
                    they are the same two rows, and leaving one of them on the
                    outgoing layer between two on the incoming one would leave this
                    section straddling both layers for no reason. The ticket's list is
                    one control short, which is recorded here rather than read as
                    licence. */}
                <div className="flex items-center gap-2">
                  <PrimitiveSwitch
                    checked={composition.iconBackground}
                    className="cover-field touch-target"
                    id="cover-icon-background"
                    onCheckedChange={(iconBackground) => set({ iconBackground })}
                  />
                  <Label htmlFor="cover-icon-background">图标背景</Label>
                </div>
              </div>
              {/* A file input is the registry's `Input` with `type="file"`, and the
                  reason is #128's, applied to the second and third of them on this
                  page: a file input is a replaced element, so it paints no `::after`
                  and its 44px is its own `h-11` — the hit-area class on it is the
                  Instrument's marker rather than an overlay. Its name comes from the
                  `<label for>` `Field` draws. */}
              <Field htmlFor="cover-icon-upload" label="上传图标">
                <Input
                  accept="image/*"
                  className="cover-field touch-target h-11"
                  id="cover-icon-upload"
                  onChange={(event) => {
                    void uploadIcon(event.currentTarget.files?.[0] ?? null);
                    // Picking the same file again has to fire again: the input would
                    // otherwise keep its value and report nothing.
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </Field>
              {/* The search is a synchronous filter over the bundled icon index, so
                  there is no debounce to preserve here — what the ticket's sentence
                  protects is the *gate's* waiting discipline, and that is what the
                  re-derived test does: it waits for a matching row (a state
                  transition) before it asserts anything about a query that matches
                  nothing. Waiting for the absence of rows passes before the lazily
                  imported icon set has landed, which is the recorded failure mode. */}
              <Field htmlFor="cover-icon-search" label="搜索图标">
                <Input
                  className="cover-field touch-target h-11"
                  id="cover-icon-search"
                  onChange={(event) => setIconQuery(event.currentTarget.value)}
                  placeholder="例如 image"
                  value={iconQuery}
                />
              </Field>
              {iconSet !== null && iconResults.length > 0 && (
                /* The grid, and the fattest declaration in the Instrument: ~50 rows
                   whose names it cannot know in advance, held by the
                   `.cover-icon-option` carrier instead (#131, the mechanism #106
                   added).

                   The height is the lesson this exact row taught (#29, the
                   thirteenth round, 406 failures): inside a capped scrolling stack,
                   flex shrinking pulls a row back to its minimum content height, and
                   **flex shrinking does not read a height** — 44px measured 20px, and
                   the neighbouring rows' 44px overlays then took each other's sample
                   points. So the height is granted by the layout (`h-11`) *and* the
                   row refuses to shrink (`shrink-0`); either one alone was measured
                   not to be enough. The stack is the incoming layer's own box rather
                   than the outgoing layer's `Stack`, which is the rest of this ticket:
                   no row here comes from the library that is leaving. */
                <div className="flex max-h-[220px] flex-col gap-1 overflow-y-auto">
                  {iconResults.map((name) => {
                    const resolved = resolveLucideIcon(iconSet, name);
                    const selected =
                      composition.icon?.source === "lucide" && composition.icon.name === name;
                    return (
                      <PrimitiveButton
                        className="cover-icon-option touch-target h-11 shrink-0 justify-start"
                        key={name}
                        onClick={() => set({ icon: { source: "lucide", name } })}
                        variant={selected ? "secondary" : "ghost"}
                      >
                        {resolved === undefined ? null : (
                          <IconGlyph
                            body={resolved.body}
                            height={resolved.height}
                            size={18}
                            width={resolved.width}
                          />
                        )}
                        {name}
                      </PrimitiveButton>
                    );
                  })}
                </div>
              )}
              {iconQuery.trim() !== "" &&
                iconResults.length === 0 && (
                  // The search's own empty state, so it moves with the search field
                  // rather than with the grid #131 takes.
                  <p className="text-sm text-muted-foreground">没有匹配的图标。</p>
                )}

              <hr className="border-t border-[var(--site-hairline)]" />
              {/* The background image, in the shape the Image Converter's drop zone
                  already uses (`apps/web/src/app/globals.css`): the dashed box is the
                  drop target while there is a pointer to drag with, and on a touch
                  pointer the box goes — `.dropzone-touch-flat` and `.drag-hint` are
                  the site's own rules for exactly that, written before this page had
                  a drop zone of its own — which leaves the file button inside it as
                  the whole of "add files", grown to a thumb target. */}
              <div
                className="cover-dropzone dropzone-touch-flat flex flex-col gap-3 rounded-lg border border-dashed border-input p-4"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void uploadBackground(event.dataTransfer.files[0] ?? null);
                }}
              >
                <p className="drag-hint text-center text-sm text-muted-foreground">
                  拖拽背景图到此处，或用下面的按钮选择
                </p>
                {/* The element `touch-targets.mjs` takes the file in, declared by
                    this hook class rather than by the outgoing library's markup: the
                    drop zone it used to live in was Mantine's. */}
                <Field htmlFor="cover-background-image" label="背景图">
                  <Input
                    accept="image/*"
                    className="add-files-button cover-background-input cover-field touch-target h-11"
                    id="cover-background-image"
                    onChange={(event) => {
                      void uploadBackground(event.currentTarget.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                    type="file"
                  />
                </Field>
              </div>
              {bgRefusal !== null && <p className="text-sm text-destructive">{bgRefusal}</p>}
              {composition.backgroundImage !== null && (
                /* The last control on this page that the outgoing layer drew. Its
                   height is its own `h-11` rather than a 36px box with a 44px
                   overlay: a target the layout grants is one every pointer can use
                   rather than one that has to be probed for, which is the rule the
                   tab row already follows. */
                <PrimitiveButton
                  className="touch-target h-11 self-start"
                  onClick={clearBackground}
                  variant="ghost"
                >
                  清除
                </PrimitiveButton>
              )}

              <hr className="border-t border-[var(--site-hairline)]" />
              <Field htmlFor="cover-font-upload" label="上传字体">
                <Input
                  accept=".woff2,.woff,.ttf,.otf"
                  className="cover-field touch-target h-11"
                  id="cover-font-upload"
                  onChange={(event) => {
                    void onUploadFont(event.currentTarget.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                  type="file"
                />
              </Field>
              {fontRefusal !== null && <p className="text-sm text-destructive">{fontRefusal}</p>}
              <PrimitiveButton
                className="touch-target h-11 self-start"
                onClick={() => void fetchSystemFonts()}
                variant="outline"
              >
                获取系统字体
              </PrimitiveButton>
              {sysHint !== null && <p className="text-sm text-muted-foreground">{sysHint}</p>}
              {/* The picker is the registry's own searchable list — `Popover` + the
                  `Command` generated for it — rather than the outgoing layer's
                  `Select`, because the rule is a *substring* filter with an empty
                  state (`rules.md`: 默认折叠、按子串、大小写不敏感、无匹配时给出文案)
                  and a Radix select filters by typeahead rather than by query. The
                  filter itself stays this Tool's pure `matchesFont`, so `shouldFilter`
                  is off and the library's own fuzzy match is not consulted.

                  The name is the `<label for>` `Field` draws, and the trigger is a
                  real form element for the same reason: `role="combobox"` on an input
                  is the shape the accessibility rules here accept and the shape the
                  Radix select this replaces had. A read-only input that opens the list
                  on click, Enter or ArrowDown is the select-only combobox of the ARIA
                  authoring practices, and the typing happens in the search field
                  inside. */}
              <Field htmlFor="cover-font" label="系统字体">
                <Popover onOpenChange={setFontPickerOpen} open={fontPickerOpen}>
                  <PopoverAnchor asChild>
                    <div className="relative">
                      {/* `role="combobox"` is what this control *is*, and the a11y rule
                          that prefers a native tag cannot see through the Primitive
                          (`Input` renders a real `<input>`), so the rule is disabled
                          for this one element rather than the semantics dropped. */}
                      {/* oxlint-disable jsx-a11y/prefer-tag-over-role -- see above. */}
                      <Input
                        aria-controls={fontPickerOpen ? "cover-font-list" : undefined}
                        aria-expanded={fontPickerOpen}
                        className="cover-field touch-target h-11 cursor-pointer pr-9"
                        disabled={sysFonts.length === 0}
                        id="cover-font"
                        onClick={() => setFontPickerOpen(true)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowDown" || event.key === "Enter") {
                            event.preventDefault();
                            setFontPickerOpen(true);
                          }
                        }}
                        placeholder={sysFonts.length === 0 ? "先获取系统字体" : "选择字体"}
                        readOnly
                        role="combobox"
                        value={chosenFont ?? ""}
                      />
                      {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-1/2 right-3 icon-[ph--caret-down-bold] -translate-y-1/2 opacity-60"
                      />
                    </div>
                  </PopoverAnchor>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] p-1"
                    id="cover-font-list"
                    // The search field is what gets typed into, so it takes the focus
                    // the popover would otherwise give the list itself — by ref rather
                    // than by `autoFocus`, which the accessibility rules here refuse.
                    onOpenAutoFocus={(event) => {
                      event.preventDefault();
                      fontSearchRef.current?.focus();
                    }}
                  >
                    <Command shouldFilter={false}>
                      <CommandInput
                        onValueChange={setFontQuery}
                        placeholder="搜索字体"
                        ref={fontSearchRef}
                        value={fontQuery}
                      />
                      <CommandList>
                        <CommandEmpty>没有匹配的字体</CommandEmpty>
                        {filteredFonts.map((family) => (
                          <CommandItem
                            key={family}
                            onSelect={() => {
                              set({ fontFamily: family });
                              setFontPickerOpen(false);
                            }}
                            value={family}
                          >
                            {family}
                          </CommandItem>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {/* A disabled control says which step is missing
                    (`apps/web/docs/design/components.md`), and the sentence changes
                    with the state: while the list has not been read the trigger
                    itself says 先获取系统字体, and this says where to press. When the
                    machine's list is *unavailable* the hint above already carries the
                    reason, so this stays silent rather than competing with it. The
                    copy is inline for #129's recorded reason: this round's scope
                    forbids touching `core/`, so the copy module the rule asks for is
                    owed to #119's consistency pass.

                    It fits one line at the editor column's own 320px, which is
                    measured rather than hoped: the first wording ran two characters
                    long and wrapped inside the 「获取系统字体」 it names, which is what
                    the look at both colour schemes caught. */}
                {sysFonts.length === 0 && sysHint === null && (
                  <p className="text-sm text-muted-foreground">
                    还没读取系统字体，先按「获取系统字体」。
                  </p>
                )}
              </Field>
            </div>
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
                {backgroundProcessingReason !== null && (
                  <p className="text-sm text-[var(--site-dimmed)]">{backgroundProcessingReason}</p>
                )}
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
                {backgroundProcessingReason !== null && (
                  <p className="text-sm text-[var(--site-dimmed)]">{backgroundProcessingReason}</p>
                )}
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
                {iconColorReason !== null && (
                  <p className="text-sm text-[var(--site-dimmed)]">{iconColorReason}</p>
                )}
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
      </div>

      {/* The canvas column, and it is the sticky element itself rather than the pane
          inside it. A sticky box can only travel inside its own containing block: the
          inner wrapper's parent was the column, which is exactly as tall as the pane,
          so it never moved at all — the preview scrolled away like a static box
          (measured 2026-09-30, recorded in `rules.md`). On the column the containing
          block is the Flex spanning both columns, so the preview really does stay in
          view while the settings scroll beneath it — hence the z-index, since it
          overlays the column that follows it on a narrow screen. */}
      <div
        className="cover-canvas-column sticky top-4 z-[2] order-1 min-w-0 flex-1 md:order-2"
        data-slot="cover-canvas-column"
      >
        {/* The preview: the full-size composition, scaled to fit the pane. The
            badge and the pixel caption sit here, not in the export. */}
        <div
          ref={wrapperRef}
          className="cover-preview-pane relative w-full overflow-hidden rounded-md border border-border bg-white"
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
          <span className="absolute top-2 left-2 text-sm text-muted-foreground" aria-hidden>
            {composition.ratioId} · {pixelCaption(composition.ratioId)}
          </span>
        </div>
      </div>

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
    </div>
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
      // The size is a class rather than the attributes alone: the incoming layer's
      // `Button` sets every `svg` it did not get a `size-*` class on to `size-4`, and
      // the selector skips the ones that have one — so this is what makes the
      // attribute and the drawing agree at the 18px the row has always used.
      className="size-[18px]"
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
