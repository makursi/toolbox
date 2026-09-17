import { Box, ColorSchemeScript, Container, mantineHtmlProps, Text } from "@mantine/core";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

import { siteDescription, siteName, siteUrl, shareMetadata } from "@/lib/site";

import { Providers } from "./providers";

import "./globals.css";

// Self-hosted at build time: `next/font` downloads these and serves them from
// this origin, so the no-outbound-requests policy in next.config.ts still holds.
const geistSans = Geist({ display: "swap", subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: siteName,
    // A pipe rather than a middle dot: it is the conventional separator in a
    // Chinese UI, and the middle dot is rationed by the design rules.
    template: `%s | ${siteName}`,
  },
  description: siteDescription,
  ...shareMetadata(siteName, siteDescription),
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    /*
     * The app icons are files rather than code, and Next wires them into the
     * head from the file convention: `icon.svg` is the mark a tab shows, and
     * `apple-icon.png` is the one iOS uses when the site is added to a home
     * screen. Both are the same drawing — see the comment in `icon.svg` for the
     * geometry and for the two values that are literal there.
     */
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang="zh-CN"
      {...mantineHtmlProps}
    >
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <Providers>
          <SiteHeader />
          {children}
        </Providers>
      </body>
    </html>
  );
}

/**
 * A slim header holding the logo and nothing else.
 *
 * There is no navigation to build yet (one Tool, two pages), so this is the way
 * home rather than a menu with one item in it. Height stays well under the 80px
 * ceiling, and it does not stick: with this little content a sticky bar would
 * cost attention it cannot pay back.
 */
function SiteHeader() {
  return (
    <Box
      component="header"
      style={{ borderBottom: "1px solid var(--mantine-color-default-border)" }}
    >
      <Container py="md" size="md">
        {/*
          The wordmark stands in for the logo until there is one. See the Assets
          section of the README: replacing this with the real mark is meant to be
          a one-line change, and no stand-in graphic is drawn in the meantime.
        */}
        <Link href="/" style={{ color: "inherit", textDecoration: "none" }}>
          <Text fw={600}>{siteName}</Text>
        </Link>
      </Container>
    </Box>
  );
}
