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
