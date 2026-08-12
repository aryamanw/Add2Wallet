import { describe, expect, it } from "vitest";
import { passDataSchema } from "./passSchema";

const validPass = {
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
};

describe("passDataSchema", () => {
  it("accepts a well-formed pass", () => {
    expect(passDataSchema.safeParse(validPass).success).toBe(true);
  });

  it("rejects an unknown style", () => {
    const result = passDataSchema.safeParse({ ...validPass, style: "loyalty" });
    expect(result.success).toBe(false);
  });

  it("rejects a color that isn't in rgb(...) format", () => {
    const result = passDataSchema.safeParse({ ...validPass, backgroundColor: "#000000" });
    expect(result.success).toBe(false);
  });

  it("rejects primaryFields with more than 3 entries", () => {
    const tooMany = Array.from({ length: 4 }, (_, i) => ({
      key: `f${i}`,
      label: `F${i}`,
      value: "x",
    }));
    const result = passDataSchema.safeParse({ ...validPass, primaryFields: tooMany });
    expect(result.success).toBe(false);
  });
});
