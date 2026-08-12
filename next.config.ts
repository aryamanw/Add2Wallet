import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "tesseract.js",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "passkit-generator",
  ],
};

export default nextConfig;
