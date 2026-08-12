// components/UploadForm.tsx
"use client";

import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { UploadSimple, FileText } from "@phosphor-icons/react/dist/ssr";
import type { PassData } from "@/lib/passSchema";
import Shell from "@/components/ui/Shell";
import Button from "@/components/ui/Button";
import StatusMessage from "@/components/ui/StatusMessage";
import styles from "./UploadForm.module.css";

type Props = {
  onExtracted: (passData: PassData, rawText: string) => void;
};

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/heic"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadForm({ onExtracted }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawTextOnFailure, setRawTextOnFailure] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

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
    <Shell>
      <div className={styles.header}>
        <h1 className={styles.title}>Add a pass</h1>
        <p className={styles.subtitle}>Upload a ticket, coupon, or membership card.</p>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneActive : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef}
            id="file-input"
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="visually-hidden"
          />
          {file ? (
            <div className={styles.selectedFile}>
              <FileText size={20} className={styles.dropzoneIcon} aria-hidden />
              <div>
                <p className={styles.selectedFileName}>{file.name}</p>
                <p className={styles.selectedFileMeta}>{formatFileSize(file.size)}</p>
              </div>
            </div>
          ) : (
            <UploadSimple size={22} className={styles.dropzoneIcon} aria-hidden />
          )}
          <p className={styles.dropzoneLabel}>
            {file ? (
              <button type="button" onClick={() => inputRef.current?.click()}>
                Choose a different file
              </button>
            ) : (
              <>
                Drag a file here, or{" "}
                <button type="button" onClick={() => inputRef.current?.click()}>
                  browse
                </button>
              </>
            )}
          </p>
          <p className={styles.dropzoneHint}>PDF, PNG, JPEG, or HEIC</p>
        </div>

        <Button type="submit" disabled={!file || loading}>
          {loading && <span className={styles.spinner} aria-hidden />}
          {loading ? "Reading document..." : "Upload"}
        </Button>

        {error && (
          <StatusMessage
            variant="error"
            details={
              rawTextOnFailure && (
                <>
                  <p className={styles.rawTextIntro}>Here&apos;s what was read from the file, if it helps:</p>
                  <pre className={styles.rawText}>{rawTextOnFailure}</pre>
                </>
              )
            }
          >
            {error}
          </StatusMessage>
        )}
      </form>
    </Shell>
  );
}
