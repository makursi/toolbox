import { Button, Container, Stack, Text, Title } from "@mantine/core";
import type { Metadata } from "next";

/**
 * The page for a URL this site does not serve.
 *
 * Next renders this inside the root layout, so the header, the theme and both
 * colour schemes come along for free — the built-in 404 is English, unstyled and
 * has no way back, which is a finished-looking site's most visible loose end.
 *
 * Three things and no more: what happened, why it probably happened, and one way
 * out. No oversized numeral and no illustration: the design forbids inventing
 * graphics, and a site with one Tool has no second destination worth suggesting.
 */
export const metadata: Metadata = { title: "没有这个页面" };

export default function NotFound() {
  return (
    /*
     * `data-slot` is an anchor, not a style and not behaviour (#114): this page is
     * part of the frame, it moves with the frame, and both Instruments have to be
     * able to address it before it moves (#161). The name is declared per page in
     * `apps/web/scripts/ui-fingerprint.mjs`.
     */
    <Container className="py-10 sm:py-16" data-slot="not-found" size="md">
      <Stack align="flex-start" className="reveal" gap="xs">
        <Title order={1}>没有这个页面</Title>
        <Text c="dimmed" maw={560}>
          你打开的地址不在这里。可能是链接写错了，也可能是这个页面已经不存在了。
        </Text>
        {/*
          `component="a"` rather than `component={Link}`: Mantine renders a real
          anchor from a string, which keeps this a Server Component. Passing
          next/link would hand a function to a Client Component, and a Server
          Component may not do that (the build rejects it, as it did here). The
          cost is a full page load on the way home, which for a 404 is the more
          robust behaviour anyway: it still works with JavaScript off.
        */}
        <Button className="touch-target" component="a" href="/" mt="md" size="md">
          回到首页
        </Button>
      </Stack>
    </Container>
  );
}
