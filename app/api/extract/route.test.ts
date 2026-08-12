import { describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import type { PassData } from "@/lib/passSchema";

vi.mock("@/lib/ocr", () => ({
  extractText: vi.fn(),
  ExtractionError: class ExtractionError extends Error {},
}));

vi.mock("@/lib/structure", () => ({
  structureText: vi.fn(),
  StructuringError: class StructuringError extends Error {
    rawText: string;
    constructor(message: string, rawText: string) {
      super(message);
      this.rawText = rawText;
    }
  },
}));

import { extractText, ExtractionError } from "@/lib/ocr";
import { structureText, StructuringError } from "@/lib/structure";
import { POST } from "./route";

function makeRequestWithFile(file: File | null) {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: formData,
  }) as unknown as NextRequest;
}

describe("POST /api/extract", () => {
  it("returns 400 when no file is provided", async () => {
    const response = await POST(makeRequestWithFile(null));
    expect(response.status).toBe(400);
  });

  it("returns structured pass data on success", async () => {
    vi.mocked(extractText).mockResolvedValue("raw ticket text");
    vi.mocked(structureText).mockResolvedValue({
      style: "generic",
    } as unknown as PassData);

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.passData.style).toBe("generic");
  });

  it("returns 422 when extraction fails", async () => {
    vi.mocked(extractText).mockRejectedValue(new ExtractionError("unreadable"));

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));

    expect(response.status).toBe(422);
  });

  it("returns 422 with the raw text when structuring fails", async () => {
    vi.mocked(extractText).mockResolvedValue("raw text");
    vi.mocked(structureText).mockRejectedValue(new StructuringError("bad json", "raw text"));

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.rawText).toBe("raw text");
  });
});
