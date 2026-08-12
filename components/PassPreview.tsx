import type { CSSProperties } from "react";
import { QrCode } from "@phosphor-icons/react/dist/ssr";
import type { PassData, PassField, PassStyle } from "@/lib/passSchema";
import styles from "./PassPreview.module.css";

const STYLE_LABELS: Record<PassStyle, string> = {
  eventTicket: "Event Ticket",
  boardingPass: "Boarding Pass",
  coupon: "Coupon",
  storeCard: "Store Card",
  generic: "Generic",
};

function FieldGroup({ fields, size }: { fields: PassField[]; size: "lg" | "sm" }) {
  if (fields.length === 0) return null;
  return (
    <div className={size === "lg" ? styles.primaryRow : styles.secondaryRow}>
      {fields.map((field) => (
        <div key={field.key} className={styles.field}>
          <span className={styles.fieldLabel}>{field.label}</span>
          <span className={size === "lg" ? styles.fieldValueLg : styles.fieldValueSm}>{field.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * The one moment of extra visual craft in the app (see PRODUCT.md: "the
 * pass preview is the reward"). Colors are live from the form; corner
 * radius and the soft ambient shadow are the documented exception to the
 * flat-by-default rule, since they echo how an Apple Wallet pass actually
 * renders as a physical stacked card.
 */
export default function PassPreview({ passData }: { passData: PassData }) {
  const cssVars = {
    "--pass-bg": passData.backgroundColor,
    "--pass-fg": passData.foregroundColor,
  } as CSSProperties;

  return (
    <div className={styles.pass} style={cssVars}>
      <div className={styles.header}>
        <span className={styles.org}>{passData.organizationName || "Organization"}</span>
        <span className={styles.badge}>{STYLE_LABELS[passData.style]}</span>
      </div>

      <div className={styles.titleBlock}>
        <p className={styles.title}>{passData.title || "Untitled pass"}</p>
        {passData.description && <p className={styles.description}>{passData.description}</p>}
      </div>

      <FieldGroup fields={passData.primaryFields} size="lg" />
      <FieldGroup fields={[...passData.secondaryFields, ...passData.auxiliaryFields]} size="sm" />

      <div className={styles.barcodeRow}>
        <QrCode size={28} weight="bold" aria-hidden />
        <div className={styles.barcodeText}>
          <span className={styles.barcodeValue}>{passData.barcodeValue || "No barcode value"}</span>
          <span className={styles.barcodeFormat}>{passData.barcodeFormat}</span>
        </div>
      </div>
    </div>
  );
}
