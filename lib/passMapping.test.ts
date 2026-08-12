import { describe, expect, it } from "vitest";
import { mapPassDataToPassJson } from "./passMapping";
import type { PassData } from "./passSchema";

const basePass: PassData = {
  style: "eventTicket",
  title: "Concert",
  organizationName: "Add2Wallet",
  description: "Concert ticket",
  barcodeValue: "TICKET123",
  barcodeFormat: "QR",
  backgroundColor: "rgb(20, 20, 20)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "event", label: "Event", value: "Concert" }],
  secondaryFields: [{ key: "date", label: "Date", value: "Jan 1" }],
  auxiliaryFields: [],
};

describe("mapPassDataToPassJson", () => {
  it("nests fields under the style-specific structure key", () => {
    const result = mapPassDataToPassJson(basePass) as any;
    expect(result.eventTicket).toEqual({
      primaryFields: basePass.primaryFields,
      secondaryFields: basePass.secondaryFields,
      auxiliaryFields: basePass.auxiliaryFields,
    });
  });

  it("maps the barcode format to the PKBarcodeFormat constant", () => {
    const result = mapPassDataToPassJson({ ...basePass, barcodeFormat: "PDF417" }) as any;
    expect(result.barcodes[0].format).toBe("PKBarcodeFormatPDF417");
  });

  it("carries description, organization, and colors through unchanged", () => {
    const result = mapPassDataToPassJson(basePass) as any;
    expect(result.description).toBe("Concert ticket");
    expect(result.organizationName).toBe("Add2Wallet");
    expect(result.backgroundColor).toBe("rgb(20, 20, 20)");
  });
});
