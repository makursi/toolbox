import { Box, Flex } from "@mantine/core";

import { resolveLucideIcon, type LucideSet } from "@/tools/cover-generator/core/icons";
import type { Composition } from "@/tools/cover-generator/core/state";

/**
 * The composition itself — two texts around a centre icon on a background.
 *
 * The preview and the off-screen export render this same markup, so it is one
 * component: "the preview and the export are the same composition" is true by
 * construction, not by keeping two copies in step. The caller scales it (the
 * preview shrinks it to fit the pane; the export draws it full size off screen).
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

  return (
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
      </Flex>
    </Box>
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
    <Box
      style={{
        background: "var(--mantine-color-default-border)",
        borderRadius: `${composition.iconRadius}%`,
        padding: 16,
      }}
    >
      <span style={{ color: iconColor, filter: iconShadow }}>
        {renderIcon(iconSet, icon, composition.iconSize)}
      </span>
    </Box>
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
