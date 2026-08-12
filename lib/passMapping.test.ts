import { describe, expect, it } from "vitest";
import { mapPassDataToPassJson } from "./passMapping";
import type { PassData } from "./passSchema";

type MappedPassJson = Record<string, unknown> & {
  barcodes: Array<{ message: string; format: string; messageEncoding: string }>;
};

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

const boardingPass: PassData = {
  ...basePass,
  style: "boardingPass",
  title: "Flight AA123",
};

describe("mapPassDataToPassJson", () => {
  it("nests fields under the style-specific structure key", () => {
    const result = mapPassDataToPassJson(basePass) as MappedPassJson;
    expect(result.eventTicket).toEqual({
      primaryFields: basePass.primaryFields,
      secondaryFields: basePass.secondaryFields,
      auxiliaryFields: basePass.auxiliaryFields,
    });
  });

  it("maps the barcode format to the PKBarcodeFormat constant", () => {
    const result = mapPassDataToPassJson({
      ...basePass,
      barcodeFormat: "PDF417",
    }) as MappedPassJson;
    expect(result.barcodes[0].format).toBe("PKBarcodeFormatPDF417");
  });

  it("carries description, organization, and colors through unchanged", () => {
    const result = mapPassDataToPassJson(basePass) as MappedPassJson;
    expect(result.description).toBe("Concert ticket");
    expect(result.organizationName).toBe("Add2Wallet");
    expect(result.backgroundColor).toBe("rgb(20, 20, 20)");
  });

  it("sets logoText from the title", () => {
    const result = mapPassDataToPassJson(basePass) as MappedPassJson;
    expect(result.logoText).toBe("Concert");
  });

  it("includes a mapped transitType for boardingPass style", () => {
    const result = mapPassDataToPassJson({
      ...boardingPass,
      transitType: "Air",
    }) as MappedPassJson;
    expect(result.boardingPass).toEqual({
      primaryFields: boardingPass.primaryFields,
      secondaryFields: boardingPass.secondaryFields,
      auxiliaryFields: boardingPass.auxiliaryFields,
      transitType: "PKTransitTypeAir",
    });
  });

  it("defaults boardingPass transitType to PKTransitTypeGeneric when omitted", () => {
    const result = mapPassDataToPassJson(boardingPass) as MappedPassJson;
    expect(
      (result.boardingPass as { transitType: string }).transitType
    ).toBe("PKTransitTypeGeneric");
  });
});
