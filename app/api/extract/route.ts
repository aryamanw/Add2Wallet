import { NextRequest, NextResponse } from "next/server";
import { ExtractionError, extractText } from "@/lib/ocr";
import { structureText, StructuringError } from "@/lib/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 10MB)" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  try {
    rawText = await extractText(buffer, file.type);
  } catch (err) {
    if (err instanceof ExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Extraction failed:", err);
    return NextResponse.json({ error: "Failed to read the uploaded file" }, { status: 500 });
  }

  try {
    const passData = await structureText(rawText);
    return NextResponse.json({ passData, rawText });
  } catch (err) {
    if (err instanceof StructuringError) {
      return NextResponse.json({ error: err.message, rawText: err.rawText }, { status: 422 });
    }
    console.error("Structuring failed:", err);
    return NextResponse.json({ error: "Failed to interpret the extracted text" }, { status: 500 });
  }
}
