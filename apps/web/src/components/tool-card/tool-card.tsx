import { Box, Flex, Paper, Stack, Text } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";

import { toolPath } from "@/tools/registry";
import type { ToolMeta } from "@/tools/types";

/**
 * The homepage's card for one Tool: a cover it may not have, a title, one line
 * of description, and the whole card as one link.
 *
 * The card is the only place a Tool's cover is used, and the rules for its shape
 * are the design doc set's, not this file's — the 4:3 frame, the cover moving under
 * the text on a narrow screen, the hairline border, and the hover shadow that is
 * a deliberate part of the design rather than a missing style. What lives here is
 * the markup those rules describe.
 */
export function ToolCard({ tool }: { tool: ToolMeta }) {
  /*
   * The cover frame exists only when there is a cover to put in it. An earlier
   * version reserved the 4:3 frame unconditionally, which meant the card's most
   * prominent box held nothing and, because that box also carried an inline
   * `width: 100%`, squeezed the text into a sliver from 768px up (Mantine's `sm`
   * is 48em, not Tailwind's 640px). A Tool without artwork is set in type.
   *
   * The frame keeps its aspect ratio when it *is* rendered, so an arriving image
   * cannot shift the layout; what changes when a cover lands is the card's shape,
   * which is a deliberate revision rather than a load-time jump.
   */
  const text = (
    <Stack gap="xs">
      {/* A notch larger on a phone: with the cover below the fold of the card
          rather than beside it, the title is the only thing doing the talking. */}
      <Text fw={500} fz={{ base: "xl", sm: "lg" }}>
        {tool.title}
      </Text>
      <Text c="dimmed">{tool.description}</Text>
      <Text mt="xs" size="sm">
        打开
        <span aria-hidden className="icon ml-1 icon-[ph--arrow-right-bold]" />
      </Text>
    </Stack>
  );

  return (
    <Link href={toolPath(tool.slug)} style={{ color: "inherit", textDecoration: "none" }}>
      <Paper className="lift" p="lg" radius="md" withBorder>
        {tool.cover ? (
          /*
           * The cover sits beside the text on a wide screen and *under* it on a
           * phone. That order comes from one prop: the markup is [cover, text],
           * `column-reverse` reads the text first on a narrow screen, and `row`
           * puts the cover back on the left from `sm` up.
           */
          <Flex direction={{ base: "column-reverse", sm: "row" }} gap="lg">
            {/* Width comes from the responsive prop alone; the rest of the
                frame is `.cover-frame` in globals.css, so no inline declaration
                can outrank a breakpoint (see apps/web/docs/design/layout.md). */}
            <Box className="cover-frame" w={{ base: "100%", sm: 220 }}>
              {/* Decorative: the card's text already names the Tool. */}
              <Image
                alt=""
                fill
                sizes="(min-width: 768px) 220px, 100vw"
                src={tool.cover}
                style={{ objectFit: "cover" }}
              />
            </Box>

            {text}
          </Flex>
        ) : (
          text
        )}
      </Paper>
    </Link>
  );
}
