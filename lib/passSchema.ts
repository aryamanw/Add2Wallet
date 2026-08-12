import { z } from "zod";

export const PASS_STYLES = [
  "eventTicket",
  "boardingPass",
  "coupon",
  "storeCard",
  "generic",
] as const;

export type PassStyle = (typeof PASS_STYLES)[number];

export const passFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
});

export type PassField = z.infer<typeof passFieldSchema>;

const rgbColor = z.string().regex(/^rgb\(\d{1,3}, ?\d{1,3}, ?\d{1,3}\)$/);

export const passDataSchema = z.object({
  style: z.enum(PASS_STYLES),
  title: z.string().min(1),
  organizationName: z.string().min(1),
  description: z.string().min(1),
  barcodeValue: z.string().min(1),
  barcodeFormat: z.enum(["QR", "PDF417", "Aztec", "Code128"]),
  backgroundColor: rgbColor,
  foregroundColor: rgbColor,
  primaryFields: z.array(passFieldSchema).min(1).max(3),
  secondaryFields: z.array(passFieldSchema).max(4),
  auxiliaryFields: z.array(passFieldSchema).max(4),
});

export type PassData = z.infer<typeof passDataSchema>;
