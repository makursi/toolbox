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
             * The homepage grows into a grid the day the second Tool lands
             * (`apps/web/docs/design/layout.md`): one Tool stays a full-width
             * row, two Tools become two columns from `sm` up. The count of
             * cells is the count of Tools; never pad a row with an empty cell.
             */
            <div className="grid gap-4 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard key={tool.slug} tool={tool} />
              ))}
            </div>
          )}
        </section>
      </Stack>
    </Container>
  );
}
