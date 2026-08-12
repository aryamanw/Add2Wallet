import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdf", () => ({
  extractPdfText: vi.fn(),
  hasEnoughEmbeddedText: vi.fn((text: string) => text.length >= 20),
  rasterizePdfToPngs: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
}));

import { createWorker } from "tesseract.js";
import { extractPdfText, rasterizePdfToPngs } from "./pdf";
import { ExtractionError, extractText, isSupportedMimeType } from "./ocr";

function mockWorker(text: string) {
  return {
    recognize: vi.fn().mockResolvedValue({ data: { text } }),
    terminate: vi.fn().mockResolvedValue(undefined),
  };
}

describe("isSupportedMimeType", () => {
  it("accepts pdf and common image types", () => {
    expect(isSupportedMimeType("application/pdf")).toBe(true);
    expect(isSupportedMimeType("image/png")).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(isSupportedMimeType("application/zip")).toBe(false);
  });
});

describe("extractText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported mime types before doing any work", async () => {
    await expect(extractText(Buffer.from(""), "application/zip")).rejects.toThrow(
      ExtractionError
    );
  });

  it("uses embedded PDF text directly when there's enough of it", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("a".repeat(30));

    const result = await extractText(Buffer.from("pdf"), "application/pdf");

    expect(result).toBe("a".repeat(30));
    expect(rasterizePdfToPngs).not.toHaveBeenCalled();
  });

  it("falls back to OCR when the PDF has no embedded text", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("");
    vi.mocked(rasterizePdfToPngs).mockResolvedValue([Buffer.from("page1")]);
    vi.mocked(createWorker).mockResolvedValue(mockWorker("scanned text") as any);

    const result = await extractText(Buffer.from("pdf"), "application/pdf");

    expect(result).toBe("scanned text");
  });

  it("OCRs images directly", async () => {
    vi.mocked(createWorker).mockResolvedValue(mockWorker("image text") as any);

    const result = await extractText(Buffer.from("img"), "image/png");

    expect(result).toBe("image text");
  });

  it("throws ExtractionError when OCR finds no text at all", async () => {
    vi.mocked(createWorker).mockResolvedValue(mockWorker("") as any);

    await expect(extractText(Buffer.from("img"), "image/png")).rejects.toThrow(
      ExtractionError
    );
  });
});
