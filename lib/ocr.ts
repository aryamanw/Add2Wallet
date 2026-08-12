import { createWorker } from "tesseract.js";
import { extractPdfText, hasEnoughEmbeddedText, rasterizePdfToPngs } from "./pdf";

const SUPPORTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/heic"];

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

export class ExtractionError extends Error {}

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (!isSupportedMimeType(mimeType)) {
    throw new ExtractionError(`Unsupported file type: ${mimeType}`);
  }

  if (mimeType === "application/pdf") {
    const embeddedText = await extractPdfText(buffer);
    if (hasEnoughEmbeddedText(embeddedText)) {
      return embeddedText;
    }

    const pageImages = await rasterizePdfToPngs(buffer);
    const ocrResults = await Promise.all(pageImages.map(ocrImage));
    const combined = ocrResults.join("\n").trim();
    if (!combined) {
      throw new ExtractionError("Could not read any text from this PDF");
    }
    return combined;
  }

  const text = await ocrImage(buffer);
  if (!text) {
    throw new ExtractionError("Could not read any text from this image");
  }
  return text;
}
