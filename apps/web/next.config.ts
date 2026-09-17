import type { NextConfig } from "next";

/**
 * Every Tool runs in the browser and the site makes no outbound requests, so
 * this policy is what enforces that rather than a promise in the README — see
 * `docs/adr/0005-no-outbound-requests.md`.
 *
 * It is deliberately static rather than nonce-based: a nonce would force every
 * page to render dynamically, and the thing a nonce buys (XSS hardening) is not
 * what this policy is here for. `'unsafe-inline'` in `script-src` is what keeps
 * the RSC payload Next inlines working; `'wasm-unsafe-eval'` is what lets the
 * image Tool instantiate its codecs.
 */
const isDevelopment = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "worker-src 'self' blob:",
  `connect-src 'self'${isDevelopment ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  /*
   * Dev-only: page origins other than `localhost` that may talk to the dev
   * server. Next rejects every other hostname and answers with a bare
   * `Unauthorized`, and — the expensive part — it holds back hydration until its
   * HMR socket connects. So the page still renders from the server and then
   * ignores every click, with one websocket error as the only clue.
   *
   * That is what `http://127.0.0.1:3000` and a phone on the LAN hit. Entries are
   * hostnames only: no scheme, no port, and `*` stands for one label. Add this
   * machine's LAN address here when testing on a real device; `10.*.*.*` covers
   * a 10/8 network like the one this was written on.
   */
  allowedDevOrigins: ["127.0.0.1", "10.*.*.*"],
  experimental: {
    // Mantine ships a module per component; this is the tree-shaking hint its
    // own Next.js guide asks for.
    optimizePackageImports: ["@mantine/core", "@mantine/hooks"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: contentSecurityPolicy }],
      },
    ];
  },
};

export default nextConfig;
