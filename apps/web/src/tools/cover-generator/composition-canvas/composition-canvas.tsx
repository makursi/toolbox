import { backdropFilter } from "@/tools/cover-generator/core/background";
import { resolveLucideIcon, type LucideSet } from "@/tools/cover-generator/core/icons";
import type { Composition } from "@/tools/cover-generator/core/state";

/**
 * The composition itself — two texts around a centre icon on a background.
 *
 * The preview and the off-screen export render this same markup, so it is one
 * component: "the preview and the export are the same composition" is true by
 * construction, not by keeping two copies in step. The caller scales it (the
 * preview shrinks it to fit the pane; the export draws it full size off screen).
 *
 * It was the last thing on the pilot page the outgoing layer drew (#132). Both
 * wrappers were plain boxes and are now plain elements, and the flex row keeps its
 * three properties exactly — centred on both axes with the composition's own gap,
 * absolutely positioned over the background — because this markup is what the
 * *export* captures: a swap that moved a pixel here would move a pixel in the
 * visitor's file. The icon plate's background was the outgoing layer's
 * `--mantine-color-default-border`, which is this site's hairline under another
 * name; it reads the site's token now, the way #126 re-pointed every other rule
 * that went through the library to reach a value of ours.
 */
export function CompositionCanvas({
  composition,
  iconSet,
}: {
  composition: Composition;
  iconSet: LucideSet | null;
}) {
  const icon = composition.icon;
  const iconColor = composition.colorSync ? composition.textColor : composition.iconColor;
  const textShadow =
    composition.shadowScope === "all" || composition.shadowScope === "text"
      ? `${composition.shadowColor} 0 2px 8px`
      : undefined;
  const iconShadow =
    composition.shadowScope === "all" || composition.shadowScope === "icon"
      ? `drop-shadow(0 2px 8px ${composition.shadowColor})`
      : undefined;

  const filter = backdropFilter(
    composition.backgroundImage,
    composition.backgroundBlur,
    composition.backgroundGrayscale,
    composition.transparent,
  );

  return (
    <div
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
      {filter !== null && (
        <div style={{ position: "absolute", inset: 0, backdropFilter: filter }} />
      )}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ gap: composition.spacing }}
      >
        <span style={textStyle(composition, textShadow)}>{composition.leftText}</span>
        {composition.iconVisible && icon !== null && (
          <IconBody
            composition={composition}
            iconColor={iconColor}
            iconSet={iconSet}
            iconShadow={iconShadow}
          />
        )}
        <span style={textStyle(composition, textShadow)}>{composition.rightText}</span>
      </div>
    </div>
  );
}

/** The shared style of the two text spans; the shadow is per-scope, so it rides along. */
function textStyle(composition: Composition, textShadow: string | undefined) {
  return {
    color: composition.textColor,
    fontFamily: composition.fontFamily ?? undefined,
    fontSize: composition.fontSize,
    fontWeight: composition.weight,
    textShadow,
  };
}

/**
 * The centre icon, with or without the background plate behind it.
 *
 * A library icon renders as inline SVG in the text colour (there is no "original
 * colour" switch); an uploaded icon is the visitor's own image, which keeps its
 * own colours.
 */
function IconBody({
  composition,
  iconColor,
  iconSet,
  iconShadow,
}: {
  composition: Composition;
  iconColor: string;
  iconSet: LucideSet | null;
  iconShadow: string | undefined;
}) {
  const icon = composition.icon;
  if (icon === null) return null;

  return composition.iconBackground ? (
    <div
      style={{
        background: "var(--site-hairline)",
        borderRadius: `${composition.iconRadius}%`,
        padding: 16,
      }}
    >
      <span style={{ color: iconColor, filter: iconShadow }}>
        {renderIcon(iconSet, icon, composition.iconSize)}
      </span>
    </div>
  ) : (
    <span style={{ color: iconColor, filter: iconShadow }}>
      {renderIcon(iconSet, icon, composition.iconSize)}
    </span>
  );
}

/** The chosen icon at `size`, as inline SVG or the visitor's own image. */
function renderIcon(iconSet: LucideSet | null, icon: Composition["icon"], size: number) {
  if (icon === null) return null;
  if (icon.source === "upload") {
    // The visitor's own image is a data: URL the browser minted; next/image
    // has no loader for that, so a plain <img> is the honest element.
    return (
      // oxlint-disable-next-line next/no-img-element -- data: URL, see above
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
