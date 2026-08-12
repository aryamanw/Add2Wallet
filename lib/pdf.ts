import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const MIN_EMBEDDED_TEXT_LENGTH = 20;
const MAX_PAGES_TO_RASTERIZE = 3;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n").trim();
}

export function hasEnoughEmbeddedText(text: string): boolean {
  return text.length >= MIN_EMBEDDED_TEXT_LENGTH;
}

export async function rasterizePdfToPngs(buffer: Buffer): Promise<Buffer[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES_TO_RASTERIZE);
  const images: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      viewport,
    }).promise;

    images.push(canvas.toBuffer("image/png"));
  }

  return images;
}
