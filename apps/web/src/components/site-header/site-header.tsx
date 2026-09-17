import { Box, Container, Flex, Text } from "@mantine/core";
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
            The wordmark stands in for the logo until there is one. See the Assets
            section of the README: replacing this with the real mark is meant to be
            a one-line change, and no stand-in graphic is drawn in the meantime.
          */}
          <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
            <Text fw={600}>{siteName}</Text>
          </Link>
          {/* The scheme follows the operating system until this is used; ADR-0008
              records why a site that refused a toggle now has one. */}
          <ThemeToggle />
        </Flex>
      </Container>
    </Box>
  );
}
