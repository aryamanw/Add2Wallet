// components/ReviewForm.tsx
"use client";

import { useState } from "react";
import type { PassData, PassField } from "@/lib/passSchema";

type Props = {
  initialPassData: PassData;
  onBack: () => void;
};

type FieldListKey = "primaryFields" | "secondaryFields" | "auxiliaryFields";

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

export default function ReviewForm({ initialPassData, onBack }: Props) {
  const [passData, setPassData] = useState<PassData>(initialPassData);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof PassData>(key: K, value: PassData[K]) {
    setPassData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    setGenerating(true);
    setError(null);

    const response = await fetch("/api/passes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(passData),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Failed to generate the pass");
      setGenerating(false);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    window.location.href = url;
    setGenerating(false);
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

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button onClick={onBack} disabled={generating}>
        Back
      </button>
      <button onClick={handleGenerate} disabled={generating} style={{ marginLeft: 8 }}>
        {generating ? "Generating..." : "Generate pass"}
      </button>
    </main>
  );
}
