import { Box, Container, Flex, Paper, Stack, Text, Title } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";

import { siteDescription, siteName } from "@/lib/site";
import { toolPath, tools } from "@/tools/registry";
import type { ToolMeta } from "@/tools/types";

export default function HomePage() {
  return (
    <Container className="py-12 sm:py-24" size="md">
      <Stack className="gap-10 sm:gap-14">
        <header className="reveal">
          <Title order={1}>{siteName}</Title>
          <Text c="dimmed" maw={560} mt="sm" size="lg">
            {siteDescription}
          </Text>
        </header>

        <section className="reveal reveal-second">
          {tools.length === 0 ? (
            <Text c="dimmed" size="sm">
              还没有工具。
            </Text>
          ) : (
            /*
             * One full-width card per Tool, stacked rather than gridded. A grid
             * would leave an empty cell with a single Tool in it, which reads as
             * a layout mistake; this shape stays honest as Tools are added and
             * becomes a grid the day it looks cramped.
             */
            <Stack gap="md">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </Stack>
          )}
        </section>
      </Stack>
    </Container>
  );
}

function ToolCard({ tool }: { tool: ToolMeta }) {
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
        打开 <span aria-hidden="true">→</span>
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
            {/* Width comes from the responsive prop alone: a `width` in `style`
                is an inline declaration and would outrank every breakpoint. The
                height stops rising once it hits the cap, which crops the cover
                instead of letting it eat the card. */}
            <Box
              style={{
                aspectRatio: "4 / 3",
                backgroundColor: "var(--mantine-color-default)",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: "var(--mantine-radius-sm)",
                flexShrink: 0,
                maxHeight: 180,
                overflow: "hidden",
                position: "relative",
              }}
              w={{ base: "100%", sm: 220 }}
            >
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
