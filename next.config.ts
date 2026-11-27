import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // The phone app's web build lives in public/phone. Its files are served as-is;
  // any other /phone path loads its index.html so the app can route it.
  async rewrites() {
    return [{ source: "/phone/:path*", destination: "/phone/index.html" }];
  },
  turbopack: {
    rules: {
      // Only the Tailwind entry uses this loader; CSS modules use Next's loader.
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
