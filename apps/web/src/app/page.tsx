import { Container, Stack, Text, Title } from "@mantine/core";

import { ToolCard } from "@/components/tool-card/tool-card";
import { siteDescription, siteName } from "@/lib/site";
import { tools } from "@/tools/registry";

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
