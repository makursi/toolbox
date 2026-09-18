import { Box, Container, Flex, Text } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle/theme-toggle";
import { siteName } from "@/lib/site";

/**
 * A slim header holding the logo and nothing else.
 *
 * There is no navigation to build yet (one Tool, two pages), so this is the way
 * home rather than a menu with one item in it. Height stays well under the 80px
 * ceiling, and it does not stick: with this little content a sticky bar would
 * cost attention it cannot pay back.
 */
export function SiteHeader() {
  return (
    <Box
      component="header"
      style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
    >
      <Container py="md" size="md">
        <Flex align="center" gap="md" justify="space-between">
          {/*
            The mark and the wordmark are one link home. The mark is the same
            character the tab shows — its crop and its sizes are in section 9 of
            `docs/design.md` — and it is decorative: the name beside it
            already says what it is, so a screen reader reading both would hear
            the site name twice.
          */}
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            <Flex align="center" gap={8}>
              <Image alt="" height={28} src="/brand/makursi.png" width={28} />
              <Text fw={600}>{siteName}</Text>
            </Flex>
          </Link>
          {/* The scheme follows the operating system until this is used; ADR-0008
              records why a site that refused a toggle now has one. */}
          <ThemeToggle />
        </Flex>
      </Container>
    </Box>
  );
}
