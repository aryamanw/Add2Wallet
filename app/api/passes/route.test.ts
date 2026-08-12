// app/api/passes/route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/buildPass", () => ({
  buildPass: vi.fn(),
}));

import { buildPass } from "@/lib/buildPass";
import { POST } from "./route";

const validPassData = {
  style: "generic",
  title: "Test Pass",
  organizationName: "Add2Wallet",
  description: "A test pass",
  barcodeValue: "ABC123",
  barcodeFormat: "QR",
  backgroundColor: "rgb(0, 0, 0)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "k", label: "L", value: "V" }],
  secondaryFields: [],
  auxiliaryFields: [],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/passes", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/passes", () => {
  it("returns 400 for invalid pass data", async () => {
    const response = await POST(makeRequest({ style: "not-a-style" }));
    expect(response.status).toBe(400);
  });

  it("returns the pkpass buffer with the correct content type on success", async () => {
    vi.mocked(buildPass).mockResolvedValue(Buffer.from("fake-pkpass-bytes"));

    const response = await POST(makeRequest(validPassData));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
  });

  it("returns 500 when signing fails", async () => {
    vi.mocked(buildPass).mockRejectedValue(new Error("bad cert"));

    const response = await POST(makeRequest(validPassData));

    expect(response.status).toBe(500);
  });
});
