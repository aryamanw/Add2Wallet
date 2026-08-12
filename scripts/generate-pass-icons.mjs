// scripts/generate-pass-icons.mjs
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "assets", "pass-icons");
mkdirSync(outDir, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.floor(size * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("W", size / 2, size / 2 + size * 0.05);
  return canvas.toBuffer("image/png");
}

writeFileSync(path.join(outDir, "icon.png"), drawIcon(29));
writeFileSync(path.join(outDir, "icon@2x.png"), drawIcon(58));
writeFileSync(path.join(outDir, "logo.png"), drawIcon(160));

console.log("Wrote placeholder pass icons to", outDir);
