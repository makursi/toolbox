import { Box, ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer/site-footer";
import { SiteHeader } from "@/components/site-header/site-header";
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
     * head from the file convention: `icon1.png` and `icon2.png` are the mark a
     * tab shows, at two sizes, and `apple-icon.png` is the one iOS uses when the
     * site is added to a home screen. All three are exports of one supplied
     * illustration — the crop, the sizes and the master are in section 9 of
     * `docs/design.md`.
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
          {/*
           * The shell is a column at least as tall as the viewport, so the footer
           * sits on the bottom edge of a short page (the homepage, a 404) instead
           * of floating halfway up it. `min-h` rather than a fixed height: the
           * Tool page is taller than the viewport and has to keep scrolling.
           */}
          <Box className="flex min-h-[100dvh] flex-col">
            <SiteHeader />
            {/* A `<main>` landmark, so the one thing a screen reader is asked to
                jump to is the content and not the chrome around it. */}
            <Box component="main" style={{ flex: 1 }}>
              {children}
            </Box>
            <SiteFooter />
          </Box>
        </Providers>
      </body>
    </html>
  );
}
