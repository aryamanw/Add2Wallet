# Add2Wallet — Design

## Purpose

A personal webapp that turns an uploaded document (PDF or image — ticket,
confirmation email screenshot, coupon, membership card, etc.) into a signed
Apple Wallet `.pkpass` file, ready to add to Wallet from an iPhone browser.

## Scope

- Single user (the owner), password-gated, hosted on the public internet.
- Handles arbitrary document types — the app infers the best Wallet pass
  style (event ticket, boarding pass, coupon, store card, or generic) per
  upload rather than assuming one fixed template.
- No accounts, no persistence/history of past passes in v1. Stateless
  request-per-pass.

## Prerequisite: Apple Developer setup

Not yet in place — required before real passes can be generated:

1. Enroll in the Apple Developer Program ($99/yr).
2. Create a **Pass Type ID** in the developer portal and generate its
   signing certificate (`.p12`).
3. Download Apple's **WWDR intermediate certificate**.
4. Both certs (base64-encoded) plus the Team ID and Pass Type Identifier are
   supplied to the app as environment secrets — never committed to the repo.

This is a setup step outside the app itself; the implementation plan should
treat missing/invalid certs as a first-class, clearly-surfaced error rather
than something that fails silently.

## Architecture & stack

- **Next.js (App Router, TypeScript)**, single app, deployed to **Vercel**.
- API routes run on the **Node.js serverless runtime** (not Edge) — required
  for `tesseract.js` (WASM OCR, no native binary dependency) and
  `passkit-generator` (pure Node; builds the manifest, signature, and zip
  for `.pkpass`).
- No database for v1. Each request is processed and its output discarded
  once the pass is downloaded — YAGNI; persistence/history can be added
  later if it turns out to be wanted.
- **Auth**: a single shared password (env var `APP_PASSWORD`). Next.js
  middleware checks it and, on success, sets a signed HTTP-only cookie
  gating the rest of the app. No real user accounts.

## Pipeline & data flow

Upload → extract → structure → review/edit → sign → add to Wallet.

1. **Upload** — `POST /api/extract`. Client sends the file (PDF or image,
   multipart), capped at ~10MB.
2. **Text extraction**:
   - PDF with embedded text → extracted directly via `pdf-parse`, no OCR.
   - PDF without embedded text, or an image → rendered to image(s) and run
     through `tesseract.js`.
3. **Structuring** — the raw extracted text is sent to an LLM via the
   **OpenRouter API** with a prompt that:
   - classifies the best Wallet pass style (event ticket / boarding pass /
     coupon / store card / generic), and
   - returns structured JSON (title, dates, barcode value + format,
     location, colors, primary/secondary fields).
   - The response is validated against a `zod` schema. One retry on invalid
     JSON (validation error appended to the prompt); a second failure
     surfaces the raw extracted text so the user can fill the form by hand.
4. **Review screen** — structured fields are shown in an editable form,
   *not* auto-submitted, so extraction mistakes can be fixed before a
   signed artifact is produced. Barcode value and dates are visually
   emphasized since they're the fields most likely to be subtly wrong and
   most costly to get wrong.
5. **Generate & sign** — `POST /api/passes`. Edited fields go to
   `passkit-generator`, signed with the Pass Type ID cert + WWDR cert from
   env secrets, producing a `.pkpass` buffer.
6. **Deliver** — response served with
   `Content-Type: application/vnd.apple.pkpass`. Opening this in iOS Safari
   triggers the native "Add to Apple Wallet" sheet directly.

## UI flow

Three screens, no navigation chrome:

1. **Login** — password field → `/api/login` → sets auth cookie.
2. **Upload** — file picker/drop zone (PDF or image). Loading state while
   extraction + structuring run, then moves to review. If extraction fails
   outright (corrupt file, wrong type, unreadable scan), shows a clear
   error with the raw OCR text dump rather than proceeding with empty data.
3. **Review & Generate** — editable form pre-filled with structured fields,
   plus a preview of the chosen pass style and colors. "Generate pass"
   calls `/api/passes` and serves the `.pkpass` immediately.

## Error handling & edge cases

- **Unreadable upload** (corrupt file, unsupported type, OCR-unreadable
  scan) → explicit error, never a silently-empty pass.
- **Invalid/incomplete LLM JSON** → one retry with the validation error in
  the prompt; on second failure, fall back to showing raw extracted text
  for manual entry instead of blocking the user entirely.
- **Missing required pass fields** (e.g. nothing barcode-worthy found) →
  review form flags them and blocks "Generate" until filled, since
  `passkit-generator` will reject or silently produce a broken pass
  otherwise.
- **Signing failures** (missing/expired/malformed cert) → surfaced as a
  clear error with the underlying cause, not swallowed. This is the
  failure mode most likely to be hit repeatedly during initial cert setup.
- **No/invalid session** → middleware redirects to login.

## Testing

- Unit tests (Vitest) for pure logic with no network dependency: the zod
  schema/validation for LLM output, and the mapping from structured fields
  to the `passkit-generator` pass model.
- Extraction (`tesseract.js`), structuring (OpenRouter), and signing are
  integration-tested manually against a handful of real sample documents
  (a PDF ticket, a screenshot, a coupon) — mocking OCR/LLM accuracy
  wouldn't be meaningful.
- No e2e/browser test framework in v1 — YAGNI for a single-user personal
  tool; manual click-through covers it.

## Explicitly out of scope for v1

- Multi-user accounts, sign-up, or per-user data isolation.
- Persisting a history of generated passes.
- Pass updates/push notifications (Apple Wallet's update-via-webservice
  mechanism).
- Android/Google Wallet support.
