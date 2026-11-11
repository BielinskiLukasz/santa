import type { NextConfig } from "next";

/**
 * Domyślnie aplikacja działa jako pełny Next.js (lokalny backend demonstracyjny).
 * CI dla GitHub Pages ustawia EXPORT_STATIC=1 => statyczny katalog out/.
 */
const isStatic = process.env.EXPORT_STATIC === "1";
const basePath = isStatic ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "") : "";

const nextConfig: NextConfig = {
  ...(isStatic ? { output: "export" as const } : {}),
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: isStatic,
};

export default nextConfig;
