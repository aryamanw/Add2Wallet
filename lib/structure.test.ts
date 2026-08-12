import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { structureText, StructuringError } from "./structure";

function mockOpenRouterResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => "",
  };
}

const validJson = JSON.stringify({
  style: "coupon",
  title: "20% off",
  organizationName: "Add2Wallet",
  description: "Coupon",
  barcodeValue: "COUPON1",
  barcodeFormat: "QR",
  backgroundColor: "rgb(0, 0, 0)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "offer", label: "Offer", value: "20% off" }],
  secondaryFields: [],
  auxiliaryFields: [],
});

describe("structureText", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns parsed pass data on a valid first response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOpenRouterResponse(validJson));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");

    expect(result.style).toBe("coupon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences before parsing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockOpenRouterResponse("```json\n" + validJson + "\n```"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");
    expect(result.style).toBe("coupon");
  });

  it("retries once with feedback when the first response is invalid, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockOpenRouterResponse("not json"))
      .mockResolvedValueOnce(mockOpenRouterResponse(validJson));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");

    expect(result.style).toBe("coupon");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallOptions = fetchMock.mock.calls[1][1] as RequestInit;
    const secondCallBody = JSON.parse(secondCallOptions.body as string);
    expect(secondCallBody.messages[1].content).toContain("previous response was invalid");
  });

  it("throws StructuringError with the raw text after two invalid attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOpenRouterResponse("still not json"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(structureText("original text")).rejects.toThrow(StructuringError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
