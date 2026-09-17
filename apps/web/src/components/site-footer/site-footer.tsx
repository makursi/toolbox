import { Box, Container, Text } from "@mantine/core";

/**
 * The last line of every page.
 *
 * One sentence, small and dimmed: what the site promises about the files is the
 * only thing worth repeating down here. A footer is also where a visitor looks
 * to see whether a page is finished, so it is a hairline and a line of text
 * rather than nothing at all.
 */
export function SiteFooter() {
  return (
    <Box
      component="footer"
      mt="xl"
      style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}
    >
      <Container py="lg" size="md">
        <Text c="dimmed" size="xs">
          文件只在这台设备上处理，不上传，也不需要账号。
        </Text>
      </Container>
    </Box>
  );
}
