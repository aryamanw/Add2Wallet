import { passDataSchema, type PassData } from "./passSchema";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-sonnet-4.5";

const SYSTEM_PROMPT = `You turn raw text extracted from an uploaded document (a ticket, receipt, coupon, membership card, or similar) into structured data for an Apple Wallet pass.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching this shape:
{
  "style": "eventTicket" | "boardingPass" | "coupon" | "storeCard" | "generic",
  "title": string,
  "organizationName": string,
  "description": string,
  "barcodeValue": string,
  "barcodeFormat": "QR" | "PDF417" | "Aztec" | "Code128",
  "backgroundColor": "rgb(r, g, b)",
  "foregroundColor": "rgb(r, g, b)",
  "primaryFields": [{ "key": string, "label": string, "value": string }],
  "secondaryFields": [{ "key": string, "label": string, "value": string }],
  "auxiliaryFields": [{ "key": string, "label": string, "value": string }]
}

Pick "style" based on what the document actually is. Use "generic" if unsure.
barcodeValue should be the most likely scannable code/confirmation number in the text; if truly nothing barcode-like exists, use the confirmation/reference number as a Code128 value.
primaryFields must have 1-3 entries, secondaryFields and auxiliaryFields up to 4 entries each.
Colors must be "rgb(r, g, b)" strings.`;

export class StructuringError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = "StructuringError";
    this.rawText = rawText;
  }
}

async function callOpenRouter(rawText: string, retryFeedback?: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: retryFeedback
        ? `Extracted text:\n${rawText}\n\nYour previous response was invalid: ${retryFeedback}\nReturn corrected JSON only.`
        : `Extracted text:\n${rawText}`,
    },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status} ${await response.text()}`);
  }

  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenRouter response missing message content");
  }
  return content;
}

function parseJsonLoosely(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenced ? fenced[1] : content;
  return JSON.parse(jsonText);
}

export async function structureText(rawText: string): Promise<PassData> {
  let lastError = "";

  for (let attempt = 0; attempt < 2; attempt++) {
    const content = await callOpenRouter(rawText, attempt === 0 ? undefined : lastError);

    let parsed: unknown;
    try {
      parsed = parseJsonLoosely(content);
    } catch (err) {
      lastError = `response was not valid JSON (${(err as Error).message})`;
      continue;
    }

    const result = passDataSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    lastError = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }

  throw new StructuringError(
    `Failed to structure extracted text after 2 attempts: ${lastError}`,
    rawText
  );
}
