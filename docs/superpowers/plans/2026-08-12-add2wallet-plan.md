# Add2Wallet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, password-gated Next.js webapp that turns an uploaded PDF/image into a signed Apple Wallet `.pkpass` file, with a review step so extraction mistakes can be corrected before signing.

**Architecture:** A single Next.js (App Router) app deployed to Vercel. Node.js serverless API routes handle text extraction (embedded PDF text, or `pdfjs-dist` rasterization + `tesseract.js` OCR as a fallback), structuring via an OpenRouter LLM call validated with `zod`, and pass building/signing via `passkit-generator`. No database — each request is processed and its output returned directly. A single shared-password cookie (via middleware) gates the whole app.

**Tech Stack:** Next.js 15+ (App Router, TypeScript), React 19, `zod`, `tesseract.js`, `pdfjs-dist`, `@napi-rs/canvas`, `passkit-generator`, Vitest, deployed on Vercel.

## Global Constraints

- Max upload size: 10MB (from spec §Pipeline step 1).
- API routes that touch OCR/LLM/signing run on the **Node.js serverless runtime**, not Edge (spec §Architecture — required for `tesseract.js` and `passkit-generator`).
- On invalid/unparseable LLM JSON: exactly **one retry** with the validation error appended to the prompt, then fail with the raw extracted text surfaced (spec §Pipeline step 3, §Error handling).
- Extracted fields are always shown on an **editable review screen** before a pass is generated — never auto-generate blind (spec §Pipeline step 4).
- `.pkpass` responses use `Content-Type: application/vnd.apple.pkpass` (spec §Pipeline step 6).
- Auth is a single shared password from env var, no user accounts (spec §Architecture).
- No database/persistence in v1; stateless per-request (spec §Scope).
- Apple Pass Type ID cert + WWDR cert are supplied as base64 env secrets, never committed (spec §Prerequisite).

---

## File Structure

```
Add2Wallet/
  middleware.ts
  next.config.ts
  vitest.config.ts
  .env.example
  scripts/
    generate-pass-icons.mjs
  assets/pass-icons/
    icon.png  icon@2x.png  logo.png
  app/
    layout.tsx
    page.tsx                    # client: Upload <-> Review state machine
    login/page.tsx               # client: password form
    api/
      login/route.ts
      extract/route.ts
      passes/route.ts
  lib/
    passSchema.ts                # zod schema + PassData/PassField types
    passMapping.ts                # PassData -> Apple pass.json shape (pure)
    auth.ts                       # password check + signed session cookie
    pdf.ts                        # PDF text extraction + rasterization
    ocr.ts                        # extraction orchestration (PDF/image -> text)
    structure.ts                  # OpenRouter call -> validated PassData
    buildPass.ts                  # PassData -> signed .pkpass Buffer
  components/
    UploadForm.tsx
    ReviewForm.tsx
```

Each `lib/*.ts` file has one responsibility and is consumed by exactly the API route(s) that need it — no file does extraction, structuring, and signing all at once, so each is independently testable and the LLM/OCR/signing boundaries stay swappable later.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: whole Next.js scaffold (via `create-next-app`), plus `vitest.config.ts`, `.env.example`
- Modify: `package.json` (scripts), `next.config.ts`

**Interfaces:**
- Produces: a working Next.js + TypeScript + Vitest project with `@/*` import alias, `npm run build`, `npm test`.

- [ ] **Step 1: Scaffold the Next.js app non-interactively**

```bash
cd /Users/aryaman/Documents/Antigravity/Add2Wallet
npx create-next-app@latest . \
  --typescript --eslint --app --no-tailwind --no-src-dir \
  --import-alias "@/*" --use-npm --yes
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install zod tesseract.js pdfjs-dist @napi-rs/canvas passkit-generator
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest vite-tsconfig-paths
```

- [ ] **Step 4: Add test scripts to `package.json`**

Edit the `"scripts"` block to add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 6: Configure `next.config.ts` to keep native/WASM deps external**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "tesseract.js",
    "pdfjs-dist",
    "@napi-rs/canvas",
    "passkit-generator",
  ],
};

export default nextConfig;
```

- [ ] **Step 7: Create `.env.example`**

```
APP_PASSWORD=
OPENROUTER_API_KEY=
APPLE_PASS_TYPE_IDENTIFIER=
APPLE_TEAM_IDENTIFIER=
APPLE_WWDR_CERT_BASE64=
APPLE_PASS_CERT_BASE64=
APPLE_PASS_CERT_PASSPHRASE=
```

Also confirm `.gitignore` (created by `create-next-app`) ignores `.env*.local`; add explicit lines for `.env` and `*.pkpass`:

```
.env
*.pkpass
```

- [ ] **Step 8: Verify the scaffold builds**

Run: `npm run build`
Expected: build succeeds with the default Next.js starter page.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with test tooling"
```

---

### Task 2: Pass data schema

**Files:**
- Create: `lib/passSchema.ts`
- Test: `lib/passSchema.test.ts`

**Interfaces:**
- Produces: `PASS_STYLES`, `PassStyle`, `PassField`, `PassData`, `passFieldSchema`, `passDataSchema` — used by every later task that touches pass data.

- [ ] **Step 1: Write the failing test**

```ts
// lib/passSchema.test.ts
import { describe, expect, it } from "vitest";
import { passDataSchema } from "./passSchema";

const validPass = {
  style: "coupon",
  title: "20% off",
  organizationName: "Add2Wallet",
  description: "Coupon",
  barcodeValue: "COUPON1",
  barcodeFormat: "QR",
  backgroundColor: "rgb(0, 0, 0)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "offer", label: "Offer", value: "20% off" }],
  secondaryFields: [],
  auxiliaryFields: [],
};

describe("passDataSchema", () => {
  it("accepts a well-formed pass", () => {
    expect(passDataSchema.safeParse(validPass).success).toBe(true);
  });

  it("rejects an unknown style", () => {
    const result = passDataSchema.safeParse({ ...validPass, style: "loyalty" });
    expect(result.success).toBe(false);
  });

  it("rejects a color that isn't in rgb(...) format", () => {
    const result = passDataSchema.safeParse({ ...validPass, backgroundColor: "#000000" });
    expect(result.success).toBe(false);
  });

  it("rejects primaryFields with more than 3 entries", () => {
    const tooMany = Array.from({ length: 4 }, (_, i) => ({
      key: `f${i}`,
      label: `F${i}`,
      value: "x",
    }));
    const result = passDataSchema.safeParse({ ...validPass, primaryFields: tooMany });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/passSchema.test.ts`
Expected: FAIL — `lib/passSchema.ts` does not exist.

- [ ] **Step 3: Write the schema**

```ts
// lib/passSchema.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/passSchema.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/passSchema.ts lib/passSchema.test.ts
git commit -m "feat: add PassData zod schema"
```

---

### Task 3: Pass field mapping

**Files:**
- Create: `lib/passMapping.ts`
- Test: `lib/passMapping.test.ts`

**Interfaces:**
- Consumes: `PassData` from `lib/passSchema.ts`.
- Produces: `mapPassDataToPassJson(data: PassData): object` — used by `lib/buildPass.ts` (Task 9).

- [ ] **Step 1: Write the failing test**

```ts
// lib/passMapping.test.ts
import { describe, expect, it } from "vitest";
import { mapPassDataToPassJson } from "./passMapping";
import type { PassData } from "./passSchema";

const basePass: PassData = {
  style: "eventTicket",
  title: "Concert",
  organizationName: "Add2Wallet",
  description: "Concert ticket",
  barcodeValue: "TICKET123",
  barcodeFormat: "QR",
  backgroundColor: "rgb(20, 20, 20)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "event", label: "Event", value: "Concert" }],
  secondaryFields: [{ key: "date", label: "Date", value: "Jan 1" }],
  auxiliaryFields: [],
};

describe("mapPassDataToPassJson", () => {
  it("nests fields under the style-specific structure key", () => {
    const result = mapPassDataToPassJson(basePass) as any;
    expect(result.eventTicket).toEqual({
      primaryFields: basePass.primaryFields,
      secondaryFields: basePass.secondaryFields,
      auxiliaryFields: basePass.auxiliaryFields,
    });
  });

  it("maps the barcode format to the PKBarcodeFormat constant", () => {
    const result = mapPassDataToPassJson({ ...basePass, barcodeFormat: "PDF417" }) as any;
    expect(result.barcodes[0].format).toBe("PKBarcodeFormatPDF417");
  });

  it("carries description, organization, and colors through unchanged", () => {
    const result = mapPassDataToPassJson(basePass) as any;
    expect(result.description).toBe("Concert ticket");
    expect(result.organizationName).toBe("Add2Wallet");
    expect(result.backgroundColor).toBe("rgb(20, 20, 20)");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/passMapping.test.ts`
Expected: FAIL — `lib/passMapping.ts` does not exist.

- [ ] **Step 3: Write the mapping function**

```ts
// lib/passMapping.ts
import type { PassData } from "./passSchema";

const BARCODE_FORMAT_MAP: Record<PassData["barcodeFormat"], string> = {
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  Aztec: "PKBarcodeFormatAztec",
  Code128: "PKBarcodeFormatCode128",
};

export function mapPassDataToPassJson(data: PassData) {
  const structureFields = {
    primaryFields: data.primaryFields,
    secondaryFields: data.secondaryFields,
    auxiliaryFields: data.auxiliaryFields,
  };

  return {
    description: data.description,
    organizationName: data.organizationName,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/passMapping.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/passMapping.ts lib/passMapping.test.ts
git commit -m "feat: map PassData to Apple pass.json structure"
```

---

### Task 4: Auth (password check + signed session cookie)

**Files:**
- Create: `lib/auth.ts`
- Test: `lib/auth.test.ts`

**Interfaces:**
- Produces: `checkPassword(candidate: string): boolean`, `createSessionCookieValue(): string`, `verifySessionCookieValue(cookieValue: string | undefined): boolean`, `SESSION_COOKIE_NAME: string` — used by `middleware.ts` and `app/api/login/route.ts` (Task 5).
- Reads env var: `APP_PASSWORD`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/auth.test.ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  checkPassword,
  createSessionCookieValue,
  verifySessionCookieValue,
} from "./auth";

describe("auth", () => {
  const originalPassword = process.env.APP_PASSWORD;

  beforeEach(() => {
    process.env.APP_PASSWORD = "correct-horse-battery-staple";
  });

  afterEach(() => {
    process.env.APP_PASSWORD = originalPassword;
  });

  describe("checkPassword", () => {
    it("returns true for the correct password", () => {
      expect(checkPassword("correct-horse-battery-staple")).toBe(true);
    });

    it("returns false for an incorrect password", () => {
      expect(checkPassword("wrong")).toBe(false);
    });
  });

  describe("session cookie round-trip", () => {
    it("verifies a cookie value it created", () => {
      const cookieValue = createSessionCookieValue();
      expect(verifySessionCookieValue(cookieValue)).toBe(true);
    });

    it("rejects a tampered cookie value", () => {
      const cookieValue = createSessionCookieValue();
      const tampered = cookieValue.slice(0, -1) + (cookieValue.endsWith("a") ? "b" : "a");
      expect(verifySessionCookieValue(tampered)).toBe(false);
    });

    it("rejects an undefined cookie value", () => {
      expect(verifySessionCookieValue(undefined)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/auth.test.ts`
Expected: FAIL — `lib/auth.ts` does not exist.

- [ ] **Step 3: Write the auth module**

```ts
// lib/auth.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "add2wallet_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.APP_PASSWORD;
  if (!secret) {
    throw new Error("APP_PASSWORD is not set");
  }
  return secret;
}

function sign(value: string): string {
  const hmac = createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function checkPassword(candidate: string): boolean {
  const expectedBuf = Buffer.from(getSecret());
  const candidateBuf = Buffer.from(candidate);
  if (expectedBuf.length !== candidateBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, candidateBuf);
}

export function createSessionCookieValue(): string {
  return sign(SESSION_VALUE);
}

export function verifySessionCookieValue(cookieValue: string | undefined): boolean {
  if (!cookieValue) return false;
  const [value, signature] = cookieValue.split(".");
  if (!value || !signature || value !== SESSION_VALUE) return false;

  const expectedSignature = sign(value).split(".")[1];
  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expectedBuf.length) return false;

  return timingSafeEqual(sigBuf, expectedBuf);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/auth.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts lib/auth.test.ts
git commit -m "feat: add password check and signed session cookie"
```

---

### Task 5: Middleware, login API route, login page

**Files:**
- Create: `middleware.ts`, `app/api/login/route.ts`, `app/login/page.tsx`

**Interfaces:**
- Consumes: `checkPassword`, `createSessionCookieValue`, `verifySessionCookieValue`, `SESSION_COOKIE_NAME` from `lib/auth.ts` (Task 4).
- Produces: `POST /api/login` accepting `{ password: string }`, setting the session cookie on success. All non-public routes require the cookie.

- [ ] **Step 1: Create `middleware.ts`**

```ts
// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionCookieValue } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/login"];

export function middleware(request: NextRequest) {
  const isPublic = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!verifySessionCookieValue(cookie)) {
    if (request.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Create `app/api/login/route.ts`**

```ts
// app/api/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import { checkPassword, createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { password } = await request.json();

  if (typeof password !== "string" || !checkPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
```

- [ ] **Step 3: Create `app/login/page.tsx`**

```tsx
// app/login/page.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    setSubmitting(false);

    if (!response.ok) {
      setError("Incorrect password");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main style={{ maxWidth: 320, margin: "80px auto", padding: 16 }}>
      <h1>Add2Wallet</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={submitting} style={{ width: "100%", padding: 8 }}>
          {submitting ? "Checking..." : "Log in"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 4: Manually verify the auth flow**

Run: `APP_PASSWORD=test123 npm run dev`, visit `http://localhost:3000/` — expect a redirect to `/login`. Enter the wrong password — expect an error. Enter `test123` — expect a redirect back to `/` with no further redirect loop.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts app/api/login/route.ts app/login/page.tsx
git commit -m "feat: add password-gated auth via middleware"
```

---

### Task 6: PDF text extraction & rasterization

**Files:**
- Create: `lib/pdf.ts`

**Interfaces:**
- Produces: `extractPdfText(buffer: Buffer): Promise<string>`, `hasEnoughEmbeddedText(text: string): boolean`, `rasterizePdfToPngs(buffer: Buffer): Promise<Buffer[]>` — used by `lib/ocr.ts` (Task 7).

No automated test for this file — it depends entirely on `pdfjs-dist` + `@napi-rs/canvas` rendering real PDF bytes, which is exercised by Task 7's manual verification against a real sample PDF instead (per spec §Testing: OCR/extraction is integration-tested manually).

- [ ] **Step 1: Write the module**

```ts
// lib/pdf.ts
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const MIN_EMBEDDED_TEXT_LENGTH = 20;
const MAX_PAGES_TO_RASTERIZE = 3;

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n").trim();
}

export function hasEnoughEmbeddedText(text: string): boolean {
  return text.length >= MIN_EMBEDDED_TEXT_LENGTH;
}

export async function rasterizePdfToPngs(buffer: Buffer): Promise<Buffer[]> {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(doc.numPages, MAX_PAGES_TO_RASTERIZE);
  const images: Buffer[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    images.push(canvas.toBuffer("image/png"));
  }

  return images;
}
```

- [ ] **Step 2: Sanity-check it compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to `lib/pdf.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf.ts
git commit -m "feat: add PDF text extraction and rasterization"
```

---

### Task 7: OCR orchestration

**Files:**
- Create: `lib/ocr.ts`
- Test: `lib/ocr.test.ts`

**Interfaces:**
- Consumes: `extractPdfText`, `hasEnoughEmbeddedText`, `rasterizePdfToPngs` from `lib/pdf.ts` (Task 6).
- Produces: `extractText(buffer: Buffer, mimeType: string): Promise<string>`, `isSupportedMimeType(mimeType: string): boolean`, `ExtractionError` — used by `app/api/extract/route.ts` (Task 10).

- [ ] **Step 1: Write the failing test**

```ts
// lib/ocr.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pdf", () => ({
  extractPdfText: vi.fn(),
  hasEnoughEmbeddedText: vi.fn((text: string) => text.length >= 20),
  rasterizePdfToPngs: vi.fn(),
}));

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
}));

import { createWorker } from "tesseract.js";
import { extractPdfText, rasterizePdfToPngs } from "./pdf";
import { ExtractionError, extractText, isSupportedMimeType } from "./ocr";

function mockWorker(text: string) {
  return {
    recognize: vi.fn().mockResolvedValue({ data: { text } }),
    terminate: vi.fn().mockResolvedValue(undefined),
  };
}

describe("isSupportedMimeType", () => {
  it("accepts pdf and common image types", () => {
    expect(isSupportedMimeType("application/pdf")).toBe(true);
    expect(isSupportedMimeType("image/png")).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(isSupportedMimeType("application/zip")).toBe(false);
  });
});

describe("extractText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unsupported mime types before doing any work", async () => {
    await expect(extractText(Buffer.from(""), "application/zip")).rejects.toThrow(
      ExtractionError
    );
  });

  it("uses embedded PDF text directly when there's enough of it", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("a".repeat(30));

    const result = await extractText(Buffer.from("pdf"), "application/pdf");

    expect(result).toBe("a".repeat(30));
    expect(rasterizePdfToPngs).not.toHaveBeenCalled();
  });

  it("falls back to OCR when the PDF has no embedded text", async () => {
    vi.mocked(extractPdfText).mockResolvedValue("");
    vi.mocked(rasterizePdfToPngs).mockResolvedValue([Buffer.from("page1")]);
    vi.mocked(createWorker).mockResolvedValue(mockWorker("scanned text") as any);

    const result = await extractText(Buffer.from("pdf"), "application/pdf");

    expect(result).toBe("scanned text");
  });

  it("OCRs images directly", async () => {
    vi.mocked(createWorker).mockResolvedValue(mockWorker("image text") as any);

    const result = await extractText(Buffer.from("img"), "image/png");

    expect(result).toBe("image text");
  });

  it("throws ExtractionError when OCR finds no text at all", async () => {
    vi.mocked(createWorker).mockResolvedValue(mockWorker("") as any);

    await expect(extractText(Buffer.from("img"), "image/png")).rejects.toThrow(
      ExtractionError
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/ocr.test.ts`
Expected: FAIL — `lib/ocr.ts` does not exist.

- [ ] **Step 3: Write the orchestration module**

```ts
// lib/ocr.ts
import { createWorker } from "tesseract.js";
import { extractPdfText, hasEnoughEmbeddedText, rasterizePdfToPngs } from "./pdf";

const SUPPORTED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/heic"];

export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType);
}

export class ExtractionError extends Error {}

async function ocrImage(buffer: Buffer): Promise<string> {
  const worker = await createWorker("eng");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (!isSupportedMimeType(mimeType)) {
    throw new ExtractionError(`Unsupported file type: ${mimeType}`);
  }

  if (mimeType === "application/pdf") {
    const embeddedText = await extractPdfText(buffer);
    if (hasEnoughEmbeddedText(embeddedText)) {
      return embeddedText;
    }

    const pageImages = await rasterizePdfToPngs(buffer);
    const ocrResults = await Promise.all(pageImages.map(ocrImage));
    const combined = ocrResults.join("\n").trim();
    if (!combined) {
      throw new ExtractionError("Could not read any text from this PDF");
    }
    return combined;
  }

  const text = await ocrImage(buffer);
  if (!text) {
    throw new ExtractionError("Could not read any text from this image");
  }
  return text;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/ocr.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ocr.ts lib/ocr.test.ts
git commit -m "feat: add OCR orchestration for PDFs and images"
```

---

### Task 8: LLM structuring via OpenRouter

**Files:**
- Create: `lib/structure.ts`
- Test: `lib/structure.test.ts`

**Interfaces:**
- Consumes: `passDataSchema` from `lib/passSchema.ts` (Task 2).
- Produces: `structureText(rawText: string): Promise<PassData>`, `StructuringError` (with a `rawText` property) — used by `app/api/extract/route.ts` (Task 10).
- Reads env var: `OPENROUTER_API_KEY`.

- [ ] **Step 1: Write the failing test**

```ts
// lib/structure.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { structureText, StructuringError } from "./structure";

function mockOpenRouterResponse(content: string) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content } }] }),
    text: async () => "",
  };
}

const validJson = JSON.stringify({
  style: "coupon",
  title: "20% off",
  organizationName: "Add2Wallet",
  description: "Coupon",
  barcodeValue: "COUPON1",
  barcodeFormat: "QR",
  backgroundColor: "rgb(0, 0, 0)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "offer", label: "Offer", value: "20% off" }],
  secondaryFields: [],
  auxiliaryFields: [],
});

describe("structureText", () => {
  const originalKey = process.env.OPENROUTER_API_KEY;

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env.OPENROUTER_API_KEY = originalKey;
  });

  it("returns parsed pass data on a valid first response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOpenRouterResponse(validJson));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");

    expect(result.style).toBe("coupon");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences before parsing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockOpenRouterResponse("```json\n" + validJson + "\n```"));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");
    expect(result.style).toBe("coupon");
  });

  it("retries once with feedback when the first response is invalid, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockOpenRouterResponse("not json"))
      .mockResolvedValueOnce(mockOpenRouterResponse(validJson));
    vi.stubGlobal("fetch", fetchMock);

    const result = await structureText("some ticket text");

    expect(result.style).toBe("coupon");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const secondCallOptions = fetchMock.mock.calls[1][1] as RequestInit;
    const secondCallBody = JSON.parse(secondCallOptions.body as string);
    expect(secondCallBody.messages[1].content).toContain("previous response was invalid");
  });

  it("throws StructuringError with the raw text after two invalid attempts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockOpenRouterResponse("still not json"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(structureText("original text")).rejects.toThrow(StructuringError);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/structure.test.ts`
Expected: FAIL — `lib/structure.ts` does not exist.

- [ ] **Step 3: Write the structuring module**

```ts
// lib/structure.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/structure.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/structure.ts lib/structure.test.ts
git commit -m "feat: structure extracted text into PassData via OpenRouter"
```

---

### Task 9: Placeholder pass icons, pass building/signing, `/api/passes`

**Files:**
- Create: `scripts/generate-pass-icons.mjs`, `assets/pass-icons/icon.png`, `assets/pass-icons/icon@2x.png`, `assets/pass-icons/logo.png`, `lib/buildPass.ts`, `app/api/passes/route.ts`
- Test: `app/api/passes/route.test.ts`

**Interfaces:**
- Consumes: `mapPassDataToPassJson` from `lib/passMapping.ts` (Task 3), `passDataSchema` from `lib/passSchema.ts` (Task 2).
- Produces: `buildPass(data: PassData): Promise<Buffer>` and `POST /api/passes` (body: `PassData` JSON, response: `.pkpass` binary with `Content-Type: application/vnd.apple.pkpass`, or JSON `{ error }` on failure).
- Reads env vars: `APPLE_PASS_TYPE_IDENTIFIER`, `APPLE_TEAM_IDENTIFIER`, `APPLE_WWDR_CERT_BASE64`, `APPLE_PASS_CERT_BASE64`, `APPLE_PASS_CERT_PASSPHRASE`.

- [ ] **Step 1: Generate placeholder pass icons**

```js
// scripts/generate-pass-icons.mjs
import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "assets", "pass-icons");
mkdirSync(outDir, { recursive: true });

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.floor(size * 0.5)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("W", size / 2, size / 2 + size * 0.05);
  return canvas.toBuffer("image/png");
}

writeFileSync(path.join(outDir, "icon.png"), drawIcon(29));
writeFileSync(path.join(outDir, "icon@2x.png"), drawIcon(58));
writeFileSync(path.join(outDir, "logo.png"), drawIcon(160));

console.log("Wrote placeholder pass icons to", outDir);
```

Run: `node scripts/generate-pass-icons.mjs`
Expected: three PNG files written under `assets/pass-icons/`.

- [ ] **Step 2: Write `lib/buildPass.ts`**

```ts
// lib/buildPass.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PKPass } from "passkit-generator";
import { mapPassDataToPassJson } from "./passMapping";
import type { PassData } from "./passSchema";

const ASSETS_DIR = path.join(process.cwd(), "assets", "pass-icons");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function loadIcons(): Promise<Record<string, Buffer>> {
  const [icon, icon2x, logo] = await Promise.all([
    readFile(path.join(ASSETS_DIR, "icon.png")),
    readFile(path.join(ASSETS_DIR, "icon@2x.png")),
    readFile(path.join(ASSETS_DIR, "logo.png")),
  ]);
  return { "icon.png": icon, "icon@2x.png": icon2x, "logo.png": logo };
}

// NOTE: passkit-generator's exact certificate-loading API can shift between
// versions. This assumes the Pass Type ID cert is a .p12 (cert+key combined,
// the format Apple's developer portal exports), unlocked with
// APPLE_PASS_CERT_PASSPHRASE. Verify against the installed package's README
// once real certs are available (see Task 12) and adjust if it differs.
export async function buildPass(data: PassData): Promise<Buffer> {
  const icons = await loadIcons();
  const passTypeIdentifier = requireEnv("APPLE_PASS_TYPE_IDENTIFIER");
  const teamIdentifier = requireEnv("APPLE_TEAM_IDENTIFIER");
  const wwdr = Buffer.from(requireEnv("APPLE_WWDR_CERT_BASE64"), "base64");
  const signerCert = Buffer.from(requireEnv("APPLE_PASS_CERT_BASE64"), "base64");
  const signerKeyPassphrase = requireEnv("APPLE_PASS_CERT_PASSPHRASE");

  const pass = new PKPass(
    icons,
    { wwdr, signerCert, signerKeyPassphrase },
    {
      ...mapPassDataToPassJson(data),
      passTypeIdentifier,
      teamIdentifier,
      serialNumber: randomUUID(),
      formatVersion: 1,
    }
  );

  return pass.getAsBuffer();
}
```

- [ ] **Step 3: Write `app/api/passes/route.ts`**

```ts
// app/api/passes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { passDataSchema } from "@/lib/passSchema";
import { buildPass } from "@/lib/buildPass";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = passDataSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid pass data", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  try {
    const pkpass = await buildPass(parsed.data);
    return new NextResponse(pkpass, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${parsed.data.title.replace(/[^a-z0-9]/gi, "_")}.pkpass"`,
      },
    });
  } catch (err) {
    console.error("Failed to build pass:", err);
    return NextResponse.json(
      { error: "Failed to generate pass. Check server certificate configuration." },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Write the failing route test**

```ts
// app/api/passes/route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/buildPass", () => ({
  buildPass: vi.fn(),
}));

import { buildPass } from "@/lib/buildPass";
import { POST } from "./route";

const validPassData = {
  style: "generic",
  title: "Test Pass",
  organizationName: "Add2Wallet",
  description: "A test pass",
  barcodeValue: "ABC123",
  barcodeFormat: "QR",
  backgroundColor: "rgb(0, 0, 0)",
  foregroundColor: "rgb(255, 255, 255)",
  primaryFields: [{ key: "k", label: "L", value: "V" }],
  secondaryFields: [],
  auxiliaryFields: [],
};

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/passes", {
    method: "POST",
    body: JSON.stringify(body),
  }) as any;
}

describe("POST /api/passes", () => {
  it("returns 400 for invalid pass data", async () => {
    const response = await POST(makeRequest({ style: "not-a-style" }));
    expect(response.status).toBe(400);
  });

  it("returns the pkpass buffer with the correct content type on success", async () => {
    vi.mocked(buildPass).mockResolvedValue(Buffer.from("fake-pkpass-bytes"));

    const response = await POST(makeRequest(validPassData));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/vnd.apple.pkpass");
  });

  it("returns 500 when signing fails", async () => {
    vi.mocked(buildPass).mockRejectedValue(new Error("bad cert"));

    const response = await POST(makeRequest(validPassData));

    expect(response.status).toBe(500);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run app/api/passes/route.test.ts`
Expected: PASS (3 tests) — `buildPass` is mocked, so this passes without real Apple certs.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-pass-icons.mjs assets/pass-icons lib/buildPass.ts app/api/passes/route.ts app/api/passes/route.test.ts
git commit -m "feat: add pass building/signing and /api/passes route"
```

---

### Task 10: `/api/extract` route

**Files:**
- Create: `app/api/extract/route.ts`
- Test: `app/api/extract/route.test.ts`

**Interfaces:**
- Consumes: `extractText`, `ExtractionError` from `lib/ocr.ts` (Task 7); `structureText`, `StructuringError` from `lib/structure.ts` (Task 8).
- Produces: `POST /api/extract` (multipart form field `file`), response `{ passData: PassData, rawText: string }` on success (200), `{ error: string, rawText?: string }` on extraction/structuring failure (422), `{ error: string }` on bad input (400) or unexpected failure (500).

- [ ] **Step 1: Write the failing test**

```ts
// app/api/extract/route.test.ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ocr", () => ({
  extractText: vi.fn(),
  ExtractionError: class ExtractionError extends Error {},
}));

vi.mock("@/lib/structure", () => ({
  structureText: vi.fn(),
  StructuringError: class StructuringError extends Error {
    rawText: string;
    constructor(message: string, rawText: string) {
      super(message);
      this.rawText = rawText;
    }
  },
}));

import { extractText, ExtractionError } from "@/lib/ocr";
import { structureText, StructuringError } from "@/lib/structure";
import { POST } from "./route";

function makeRequestWithFile(file: File | null) {
  const formData = new FormData();
  if (file) formData.set("file", file);
  return new Request("http://localhost/api/extract", {
    method: "POST",
    body: formData,
  }) as any;
}

describe("POST /api/extract", () => {
  it("returns 400 when no file is provided", async () => {
    const response = await POST(makeRequestWithFile(null));
    expect(response.status).toBe(400);
  });

  it("returns structured pass data on success", async () => {
    vi.mocked(extractText).mockResolvedValue("raw ticket text");
    vi.mocked(structureText).mockResolvedValue({ style: "generic" } as any);

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.passData.style).toBe("generic");
  });

  it("returns 422 when extraction fails", async () => {
    vi.mocked(extractText).mockRejectedValue(new ExtractionError("unreadable"));

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));

    expect(response.status).toBe(422);
  });

  it("returns 422 with the raw text when structuring fails", async () => {
    vi.mocked(extractText).mockResolvedValue("raw text");
    vi.mocked(structureText).mockRejectedValue(new StructuringError("bad json", "raw text"));

    const file = new File(["hello"], "ticket.png", { type: "image/png" });
    const response = await POST(makeRequestWithFile(file));
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.rawText).toBe("raw text");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/api/extract/route.test.ts`
Expected: FAIL — `app/api/extract/route.ts` does not exist.

- [ ] **Step 3: Write the route**

```ts
// app/api/extract/route.ts
import { NextRequest, NextResponse } from "next/server";
import { ExtractionError, extractText } from "@/lib/ocr";
import { structureText, StructuringError } from "@/lib/structure";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/api/extract/route.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/extract/route.ts app/api/extract/route.test.ts
git commit -m "feat: add /api/extract route orchestrating OCR and structuring"
```

---

### Task 11: Upload UI and Review UI

**Files:**
- Create: `components/UploadForm.tsx`, `components/ReviewForm.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `PassData`, `PassField` types from `lib/passSchema.ts` (Task 2); calls `POST /api/extract` (Task 10) and `POST /api/passes` (Task 9) over HTTP from the client.

No automated test for these components (per spec §Testing: no e2e/browser framework in v1) — verified manually in Step 4.

- [ ] **Step 1: Write `components/UploadForm.tsx`**

```tsx
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

    const response = await fetch("/api/extract", { method: "POST", body: formData });
    const body = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(body.error ?? "Failed to process the file");
      if (typeof body.rawText === "string") {
        setRawTextOnFailure(body.rawText);
      }
      return;
    }

    onExtracted(body.passData, body.rawText);
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
```

- [ ] **Step 2: Write `components/ReviewForm.tsx`**

```tsx
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
```

- [ ] **Step 3: Wire both into `app/page.tsx`**

```tsx
// app/page.tsx
"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import ReviewForm from "@/components/ReviewForm";
import type { PassData } from "@/lib/passSchema";

type Screen = { name: "upload" } | { name: "review"; passData: PassData };

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>({ name: "upload" });

  if (screen.name === "review") {
    return (
      <ReviewForm
        initialPassData={screen.passData}
        onBack={() => setScreen({ name: "upload" })}
      />
    );
  }

  return (
    <UploadForm
      onExtracted={(passData) => setScreen({ name: "review", passData })}
    />
  );
}
```

- [ ] **Step 4: Manually verify the full upload → review flow**

Run: `APP_PASSWORD=test123 OPENROUTER_API_KEY=<your key> npm run dev`. Log in, upload a real sample document (e.g. a PDF ticket or a screenshot with visible text), confirm the review screen shows plausible extracted fields, edit a field, click "Generate pass" — confirm a `.pkpass` download starts (it will fail signing with a clear 500 until Apple certs are configured in Task 12 — that's expected at this point).

- [ ] **Step 5: Commit**

```bash
git add components/UploadForm.tsx components/ReviewForm.tsx app/page.tsx
git commit -m "feat: add upload and review UI"
```

---

### Task 12: Deployment config & README

**Files:**
- Create: `README.md`

**Interfaces:** None — documentation and deployment wiring only.

- [ ] **Step 1: Write `README.md`**

```md
# Add2Wallet

Upload a PDF or image (ticket, coupon, membership card, etc.) and get back a
signed Apple Wallet `.pkpass` file, after a chance to review/correct the
extracted fields.

## How it works

Upload → text extraction (embedded PDF text, or `pdfjs-dist` rasterization +
`tesseract.js` OCR as a fallback) → structuring via an OpenRouter LLM call →
editable review form → signing via `passkit-generator` → `.pkpass` download,
which iOS Safari turns into an "Add to Apple Wallet" prompt.

## Prerequisites

1. **Apple Developer Program membership** ($99/yr) — https://developer.apple.com/programs/
2. In the developer portal, create a **Pass Type ID**, then generate and
   download its signing certificate as a `.p12` file (via Keychain Access:
   create a CSR, upload it to get a `.cer`, import into Keychain, then
   export the identity as `.p12` with a passphrase).
3. Download Apple's **WWDR intermediate certificate** (G4) from
   https://www.apple.com/certificateauthority/ and convert it to PEM if needed:
   `openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem`
4. Base64-encode both certs for use as env vars:
   `base64 -i Certificates.p12 | tr -d '\n'`
   `base64 -i wwdr.pem | tr -d '\n'`
5. Get an **OpenRouter API key** — https://openrouter.ai/

## Environment variables

See `.env.example`. Set these in Vercel under Project Settings → Environment
Variables (and in a local `.env` for `npm run dev`, which is gitignored):

- `APP_PASSWORD` — the single shared password gating the app.
- `OPENROUTER_API_KEY` — for the structuring step.
- `APPLE_PASS_TYPE_IDENTIFIER` — e.g. `pass.com.yourdomain.add2wallet`.
- `APPLE_TEAM_IDENTIFIER` — your Apple Developer Team ID.
- `APPLE_WWDR_CERT_BASE64` — base64 of the WWDR PEM cert.
- `APPLE_PASS_CERT_BASE64` — base64 of your Pass Type ID `.p12`.
- `APPLE_PASS_CERT_PASSPHRASE` — the passphrase you set when exporting the `.p12`.

## Local development

```bash
npm install
npm run dev
npm test
```

## Deploying

```bash
npx vercel
```

Set the environment variables above in the Vercel dashboard before the first
real (non-mocked) pass generation. `/api/extract` and `/api/passes` run on
the Node.js serverless runtime with `maxDuration` set per-route; if OCR on
larger documents times out on the Vercel Hobby plan, either upgrade to Pro
or reduce `MAX_PAGES_TO_RASTERIZE` in `lib/pdf.ts`.

## Manual verification checklist

Automated tests cover schema validation, field mapping, OCR branching logic,
and LLM-response handling with mocks. The following need a real device/certs
and are verified by hand (per design spec — mocking OCR/LLM accuracy isn't
meaningful):

- [ ] Upload a real PDF ticket with embedded text — confirm fields extracted correctly.
- [ ] Upload a real screenshot/photo (image, no embedded text) — confirm OCR + structuring produces reasonable fields.
- [ ] Upload a coupon-style document — confirm it's classified as `coupon` rather than `eventTicket`.
- [ ] With real Apple certs configured, generate a pass and confirm it opens the "Add to Apple Wallet" sheet on an iPhone in Safari.
- [ ] Confirm a wrong password is rejected and the correct password logs in.
```

- [ ] **Step 2: Verify the full test suite and build pass together**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and deployment instructions"
```

---

## Self-Review Notes

- **Spec coverage:** Prerequisite (Task 12/README), architecture & stack (Task 1), pipeline steps 1-6 (Tasks 6-11), review screen (Task 11), all error-handling cases from the spec (unreadable upload → Task 7/10; invalid LLM JSON + retry → Task 8; missing required fields → schema `min(1)` on `primaryFields` in Task 2 plus review UI in Task 11; signing failures → Task 9's 500 path; wrong password → Task 4/5), testing approach (unit tests in Tasks 2/3/4/7/8/9/10, manual checklist in Task 12) are all covered.
- **Placeholder scan:** no TBD/TODO markers; every step has runnable code or an exact command.
- **Type consistency:** `PassData`/`PassField` from Task 2 are used with the same shape in Tasks 3, 8, 9, 10, 11. `extractText`/`ExtractionError` (Task 7) and `structureText`/`StructuringError` (Task 8) signatures match their usage in Task 10. `buildPass` (Task 9) signature matches its usage in the `/api/passes` route.
- **Scope:** single cohesive app, no independent subsystems requiring separate plans.
