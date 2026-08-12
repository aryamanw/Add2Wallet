import type { PassData } from "./passSchema";

const BARCODE_FORMAT_MAP: Record<PassData["barcodeFormat"], string> = {
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  Aztec: "PKBarcodeFormatAztec",
  Code128: "PKBarcodeFormatCode128",
};

const TRANSIT_TYPE_MAP: Record<
  NonNullable<PassData["transitType"]>,
  string
> = {
  Air: "PKTransitTypeAir",
  Boat: "PKTransitTypeBoat",
  Bus: "PKTransitTypeBus",
  Generic: "PKTransitTypeGeneric",
  Train: "PKTransitTypeTrain",
};

export function mapPassDataToPassJson(data: PassData) {
  const structureFields = {
    primaryFields: data.primaryFields,
    secondaryFields: data.secondaryFields,
    auxiliaryFields: data.auxiliaryFields,
    ...(data.style === "boardingPass"
      ? { transitType: TRANSIT_TYPE_MAP[data.transitType ?? "Generic"] }
      : {}),
  };

  return {
    description: data.description,
    organizationName: data.organizationName,
    logoText: data.title,
    backgroundColor: data.backgroundColor,
    foregroundColor: data.foregroundColor,
    barcodes: [
      {
        message: data.barcodeValue,
        format: BARCODE_FORMAT_MAP[data.barcodeFormat],
        messageEncoding: "iso-8859-1",
      },
    ],
    [data.style]: structureFields,
  };
}
