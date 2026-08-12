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

type Props = {
  initialPassData: PassData;
  onBack: () => void;
};

type FieldListKey = "primaryFields" | "secondaryFields" | "auxiliaryFields";
type TransitType = NonNullable<PassData["transitType"]>;

const TRANSIT_TYPES: TransitType[] = ["Air", "Boat", "Bus", "Generic", "Train"];

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
  fields,
  onChange,
  emphasize,
}: {
  title: string;
  fields: PassField[];
  onChange: (fields: PassField[]) => void;
  emphasize?: boolean;
}) {
  return (
    <fieldset style={{ marginBottom: 12 }}>
      <legend>{title}</legend>
      {fields.map((field, i) => (
        <div key={field.key} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <input
            value={field.label}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...field, label: e.target.value };
              onChange(next);
            }}
            style={{ flex: 1 }}
          />
          <input
            value={field.value}
            onChange={(e) => {
              const next = [...fields];
              next[i] = { ...field, value: e.target.value };
              onChange(next);
            }}
            style={{ flex: 1, fontWeight: emphasize ? "bold" : "normal" }}
          />
        </div>
      ))}
    </fieldset>
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
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h1>Review pass</h1>

      <label>
        Title
        <input
          value={passData.title}
          onChange={(e) => updateField("title", e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
      </label>

      <label>
        Description
        <input
          value={passData.description}
          onChange={(e) => updateField("description", e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
      </label>

      <label>
        Organization name
        <input
          value={passData.organizationName}
          onChange={(e) => updateField("organizationName", e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
      </label>

      <label>
        Style
        <select
          value={passData.style}
          onChange={(e) => updateField("style", e.target.value as PassStyle)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        >
          {PASS_STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>
      </label>

      {passData.style === "boardingPass" && (
        <label>
          Transit type
          <select
            value={passData.transitType ?? "Generic"}
            onChange={(e) => updateField("transitType", e.target.value as TransitType)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
          >
            {TRANSIT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
      )}

      <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
        <label style={{ flex: 1 }}>
          Background color
          <input
            type="color"
            value={rgbStringToHex(passData.backgroundColor)}
            onChange={(e) => updateField("backgroundColor", hexToRgbString(e.target.value))}
            style={{ width: "100%", padding: 4 }}
          />
        </label>
        <label style={{ flex: 1 }}>
          Foreground color
          <input
            type="color"
            value={rgbStringToHex(passData.foregroundColor)}
            onChange={(e) => updateField("foregroundColor", hexToRgbString(e.target.value))}
            style={{ width: "100%", padding: 4 }}
          />
        </label>
      </div>

      <label>
        Barcode value
        <input
          value={passData.barcodeValue}
          onChange={(e) => updateField("barcodeValue", e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 12, fontWeight: "bold" }}
        />
      </label>

      <FieldListEditor
        title="Primary fields"
        fields={passData.primaryFields}
        onChange={(fields) => updateField("primaryFields" as FieldListKey, fields)}
        emphasize
      />
      <FieldListEditor
        title="Secondary fields (dates usually go here)"
        fields={passData.secondaryFields}
        onChange={(fields) => updateField("secondaryFields" as FieldListKey, fields)}
        emphasize
      />
      <FieldListEditor
        title="Auxiliary fields"
        fields={passData.auxiliaryFields}
        onChange={(fields) => updateField("auxiliaryFields" as FieldListKey, fields)}
      />

      {!validation.success && validationMessages.length > 0 && (
        <div style={{ color: "#b45309", marginBottom: 12 }}>
          <p>Fix the following before generating:</p>
          <ul>
            {validationMessages.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div style={{ color: "red", marginBottom: 12 }}>
          <p>{error}</p>
          {serverIssues.length > 0 && (
            <ul>
              {serverIssues.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button onClick={onBack} disabled={generating}>
        Back
      </button>
      <button
        onClick={handleGenerate}
        disabled={generating || !validation.success}
        style={{ marginLeft: 8 }}
      >
        {generating ? "Generating..." : "Generate pass"}
      </button>
    </main>
  );
}
