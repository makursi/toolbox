import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer/site-footer";
import { SiteHeader } from "@/components/site-header/site-header";
import { colorSchemeScript } from "@/lib/color-scheme";
import { siteDescription, siteName, siteUrl, shareMetadata } from "@/lib/site";
import { tokensCss } from "@/lib/tokens";

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
     * illustration — the crop, the sizes and the master are in
     * `apps/web/docs/design/assets.md`.
     *
     * `suppressHydrationWarning` is on the `<html>` element for one reason: the
     * scheme script below writes `data-color-scheme` before React hydrates, so the
     * server's markup and the client's first render disagree about one attribute on
     * one element — deliberately, and in the only way that avoids a flash of the
     * wrong scheme. React warns about exactly that mismatch, and this is React's own
     * way of being told it was intended.
     */
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      lang="zh-CN"
      suppressHydrationWarning
    >
      <head>
        {/*
         * The colour scheme is decided before the first paint, and by exactly one
         * mechanism: this script reads the stored preference (or, with none, the
         * operating system's — which is the only thing that can read it before a
         * paint) and writes `data-color-scheme` on `<html>`. The stylesheet's `dark`
         * variant and this site's tokens are both defined against that one attribute
         * (`apps/web/docs/design/colour.md`), and `src/lib/color-scheme.ts` is the
         * whole of the policy.
         */}
        <script dangerouslySetInnerHTML={{ __html: colorSchemeScript() }} />
        {/*
         * The site's values, published from the single source in
         * `src/lib/tokens.ts` — and since #168 the only end of that source there is:
         * the outgoing layer's runtime resolver went with the library. Emitted here,
         * server-side, so the properties are in the document before anything paints;
         * `globals.css` maps the new layer's utility names onto them. A stylesheet
         * that repeated these values would be a second owner of colour (#111).
         */}
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body>
        {/*
         * The shell is a column at least as tall as the viewport, so the footer
         * sits on the bottom edge of a short page (the homepage, a 404) instead
         * of floating halfway up it. `min-h` rather than a fixed height: the
         * Tool page is taller than the viewport and has to keep scrolling.
         */}
        {/*
         * `data-slot` is an anchor, not a style and not behaviour: it names the
         * region so `apps/web/scripts/ui-fingerprint.mjs` can address this page
         * by an attribute of ours instead of by the component library's class
         * names and content-hashed module classes, which a change of component
         * layer moves by construction (#114). The vocabulary is the incoming
         * layer's own — it stamps `data-slot` on everything it renders — so the
         * two ends of the migration speak the same language and no translation
         * table is needed. Every anchor the fingerprint reads is declared, per
         * page, in that script; a slot added here and not declared there is not
         * read.
         */}
        <div className="flex min-h-[100dvh] flex-col" data-slot="page-shell">
          <SiteHeader />
          {/* A `<main>` landmark, so the one thing a screen reader is asked to
              jump to is the content and not the chrome around it. */}
          <main className="flex-1" data-slot="site-main">
            {children}
          </main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
