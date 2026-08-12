// components/UploadForm.tsx
"use client";

import { useState, type FormEvent } from "react";
import type { PassData } from "@/lib/passSchema";

type Props = {
  onExtracted: (passData: PassData, rawText: string) => void;
};

export default function UploadForm({ onExtracted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawTextOnFailure, setRawTextOnFailure] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    setRawTextOnFailure(null);

    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/extract", { method: "POST", body: formData });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Failed to process the file");
        if (typeof body.rawText === "string") {
          setRawTextOnFailure(body.rawText);
        }
        return;
      }

      onExtracted(body.passData, body.rawText);
    } catch {
      setError("Failed to process the file");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", padding: 16 }}>
      <h1>Add2Wallet</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/heic"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button type="submit" disabled={!file || loading} style={{ marginLeft: 8 }}>
          {loading ? "Reading document..." : "Upload"}
        </button>
      </form>
      {error && (
        <div style={{ marginTop: 16, color: "red" }}>
          <p>{error}</p>
          {rawTextOnFailure && (
            <>
              <p>Here&apos;s what was read from the file, if it helps:</p>
              <pre style={{ whiteSpace: "pre-wrap" }}>{rawTextOnFailure}</pre>
            </>
          )}
        </div>
      )}
    </main>
  );
}
