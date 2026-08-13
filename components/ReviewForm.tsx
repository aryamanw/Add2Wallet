// components/ReviewForm.tsx
"use client";

import { useMemo, useState } from "react";
import {
  PASS_STYLES,
  passDataSchema,
  type PassData,
  type PassField,
  type PassStyle,
} from "@/lib/passSchema";
import Shell from "@/components/ui/Shell";
import Field from "@/components/ui/Field";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import PassPreview from "@/components/PassPreview";
import inputStyles from "@/components/ui/inputs.module.css";
import styles from "./ReviewForm.module.css";

type Props = {
  initialPassData: PassData;
  onBack: () => void;
};

type FieldListKey = "primaryFields" | "secondaryFields" | "auxiliaryFields";
type TransitType = NonNullable<PassData["transitType"]>;

const TRANSIT_TYPES: TransitType[] = ["Air", "Boat", "Bus", "Generic", "Train"];
const BARCODE_FORMATS: PassData["barcodeFormat"][] = ["QR", "PDF417", "Aztec", "Code128"];
const STYLE_LABELS: Record<PassStyle, string> = {
  eventTicket: "Event ticket",
  boardingPass: "Boarding pass",
  coupon: "Coupon",
  storeCard: "Store card",
  generic: "Generic",
};

/** Converts a "#rrggbb" color picker value into the schema's "rgb(r, g, b)" string. */
function hexToRgbString(hex: string): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return "rgb(0, 0, 0)";
  const [, r, g, b] = match;
  return `rgb(${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)})`;
}

/** Converts a schema "rgb(r, g, b)" string into a "#rrggbb" value for a color picker. */
function rgbStringToHex(rgb: string): string {
  const match = /^rgb\((\d{1,3}), ?(\d{1,3}), ?(\d{1,3})\)$/.exec(rgb);
  if (!match) return "#000000";
  const [, r, g, b] = match;
  const toHex = (n: string) => Math.min(255, parseInt(n, 10)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function FieldListEditor({
  title,
  hint,
  fields,
  onChange,
  mono,
}: {
  title: string;
  hint?: string;
  fields: PassField[];
  onChange: (fields: PassField[]) => void;
  mono?: boolean;
}) {
  if (fields.length === 0) return null;
  return (
    <div>
      <p className={styles.fieldGroupHeading}>
        {title} {hint && <span className={styles.fieldGroupHint}>· {hint}</span>}
      </p>
      <div className={styles.fieldList}>
        {fields.map((field, i) => (
          <div key={field.key} className={styles.fieldListRow}>
            <input
              value={field.label}
              onChange={(e) => {
                const next = [...fields];
                next[i] = { ...field, label: e.target.value };
                onChange(next);
              }}
              aria-label={`${title} label ${i + 1}`}
              className={`${inputStyles.input} ${styles.fieldListLabelInput}`}
            />
            <input
              value={field.value}
              onChange={(e) => {
                const next = [...fields];
                next[i] = { ...field, value: e.target.value };
                onChange(next);
              }}
              aria-label={`${title} value ${i + 1}`}
              className={`${inputStyles.input} ${styles.fieldListValueInput} ${mono ? inputStyles.mono : ""}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function formatIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}

export default function ReviewForm({ initialPassData, onBack }: Props) {
  const [passData, setPassData] = useState<PassData>(initialPassData);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<string[]>([]);

  function updateField<K extends keyof PassData>(key: K, value: PassData[K]) {
    setPassData((prev) => ({ ...prev, [key]: value }));
  }

  const validation = useMemo(() => passDataSchema.safeParse(passData), [passData]);
  const validationMessages = validation.success ? [] : validation.error.issues.map(formatIssue);

  async function handleGenerate() {
    if (!validation.success) return;

    setGenerating(true);
    setError(null);
    setServerIssues([]);

    try {
      const response = await fetch("/api/passes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passData),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "Failed to generate the pass");
        if (Array.isArray(body.issues)) {
          setServerIssues(body.issues.map(formatIssue));
        }
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.location.href = url;
    } catch {
      setError("Failed to generate the pass");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Shell width="xwide">
      <div className={styles.header}>
        <h1 className={styles.title}>Review pass</h1>
        <p className={styles.subtitle}>
          Check the details below, especially the barcode and dates, before generating.
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.previewCol}>
          <PassPreview passData={passData} />
          <p className={styles.previewCaption}>This is what lands in Wallet.</p>
        </div>

        <form
          className={styles.form}
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Details</h2>

            <Field label="Title" htmlFor="title">
              <input
                id="title"
                value={passData.title}
                onChange={(e) => updateField("title", e.target.value)}
                className={inputStyles.input}
              />
            </Field>

            <Field label="Description" htmlFor="description">
              <input
                id="description"
                value={passData.description}
                onChange={(e) => updateField("description", e.target.value)}
                className={inputStyles.input}
              />
            </Field>

            <Field label="Organization name" htmlFor="organizationName">
              <input
                id="organizationName"
                value={passData.organizationName}
                onChange={(e) => updateField("organizationName", e.target.value)}
                className={inputStyles.input}
              />
            </Field>

            <div className={styles.row}>
              <Field label="Style" htmlFor="style">
                <select
                  id="style"
                  value={passData.style}
                  onChange={(e) => updateField("style", e.target.value as PassStyle)}
                  className={inputStyles.select}
                >
                  {PASS_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {STYLE_LABELS[style]}
                    </option>
                  ))}
                </select>
              </Field>

              {passData.style === "boardingPass" && (
                <Field label="Transit type" htmlFor="transitType">
                  <select
                    id="transitType"
                    value={passData.transitType ?? "Generic"}
                    onChange={(e) => updateField("transitType", e.target.value as TransitType)}
                    className={inputStyles.select}
                  >
                    {TRANSIT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Appearance</h2>
            <div className={styles.row}>
              <Field label="Background color" htmlFor="backgroundColor">
                <input
                  id="backgroundColor"
                  type="color"
                  value={rgbStringToHex(passData.backgroundColor)}
                  onChange={(e) => updateField("backgroundColor", hexToRgbString(e.target.value))}
                  className={inputStyles.colorInput}
                />
              </Field>
              <Field label="Foreground color" htmlFor="foregroundColor">
                <input
                  id="foregroundColor"
                  type="color"
                  value={rgbStringToHex(passData.foregroundColor)}
                  onChange={(e) => updateField("foregroundColor", hexToRgbString(e.target.value))}
                  className={inputStyles.colorInput}
                />
              </Field>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Barcode</h2>
            <div className={styles.row}>
              <Field label="Barcode value" htmlFor="barcodeValue" hint="Verify this carefully — a wrong value means the pass won't scan.">
                <input
                  id="barcodeValue"
                  value={passData.barcodeValue}
                  onChange={(e) => updateField("barcodeValue", e.target.value)}
                  className={`${inputStyles.input} ${inputStyles.mono}`}
                />
              </Field>
              <Field label="Barcode format" htmlFor="barcodeFormat">
                <select
                  id="barcodeFormat"
                  value={passData.barcodeFormat}
                  onChange={(e) => updateField("barcodeFormat", e.target.value as PassData["barcodeFormat"])}
                  className={inputStyles.select}
                >
                  {BARCODE_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {format}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Fields</h2>
            <FieldListEditor
              title="Primary fields"
              fields={passData.primaryFields}
              onChange={(fields) => updateField("primaryFields" as FieldListKey, fields)}
              mono
            />
            <FieldListEditor
              title="Secondary fields"
              hint="dates usually go here"
              fields={passData.secondaryFields}
              onChange={(fields) => updateField("secondaryFields" as FieldListKey, fields)}
              mono
            />
            <FieldListEditor
              title="Auxiliary fields"
              fields={passData.auxiliaryFields}
              onChange={(fields) => updateField("auxiliaryFields" as FieldListKey, fields)}
            />
          </div>

          {!validation.success && validationMessages.length > 0 && (
            <StatusMessage
              details={
                <ul>
                  {validationMessages.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              }
            >
              Fix the following before generating
            </StatusMessage>
          )}

          {error && (
            <StatusMessage
              details={
                serverIssues.length > 0 && (
                  <ul>
                    {serverIssues.map((message, i) => (
                      <li key={i}>{message}</li>
                    ))}
                  </ul>
                )
              }
            >
              {error}
            </StatusMessage>
          )}

          <div className={styles.actions}>
            <Button type="button" variant="ghost" onClick={onBack} disabled={generating}>
              Back
            </Button>
            <Button type="submit" disabled={generating || !validation.success}>
              {generating ? "Generating..." : "Generate pass"}
            </Button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
