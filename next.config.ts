import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The landing page mockup (public/landing.html) links to /login.html; send that to the real login page.
  async redirects() {
    return [{ source: "/login.html", destination: "/login", permanent: false }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Show the landing page design (public/landing.html) at "/". It runs before the
  // app's own src/app/page.tsx, which stays until the landing page is rebuilt in Next.js.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/landing.html" }] };
  },
};

export default nextConfig;
