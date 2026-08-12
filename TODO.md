# TODO

Follow-up work deferred during initial development, tracked here since it
isn't visible from the code alone.

## Needs a real device / real Apple certs to resolve

- [ ] **Verify the Add-to-Wallet flow actually works on iPhone Safari.**
  `ReviewForm.tsx`'s pass download uses `fetch` → `response.blob()` →
  `URL.createObjectURL()` → `window.location.href = url`, rather than a
  direct top-level navigation to a URL serving
  `Content-Type: application/vnd.apple.pkpass`. This may not reliably
  trigger iOS Safari's native "Add to Apple Wallet" sheet the way a real
  network response does — genuinely untested, since it requires both a
  real Apple Pass Type ID cert (see README Prerequisites) and a physical
  iPhone. If it doesn't work, the fallback is a plain `<a>`/form-based
  top-level navigation to `/api/passes` instead of the blob-URL approach.
- [ ] Confirm the app's 10MB upload cap (`MAX_FILE_BYTES` in
  `app/api/extract/route.ts`) doesn't collide with Vercel's actual request
  body size limit for the deployed plan/config (see the caveat already
  noted in README's Deploying section). Lower the constant if it does.

## Test coverage gaps

- [ ] `lib/buildPass.test.ts` covers the multi-**cert**-bag ambiguity error
  path but not the symmetric multi-**key**-bag branch in
  `extractCertAndKeyFromP12` (`lib/buildPass.ts`) — structurally identical
  logic, low risk, but untested. `forge.pkcs12.toPkcs12Asn1` only accepts a
  single key argument, so a synthetic multi-key-bag `.p12` fixture would
  need to be hand-built at the ASN.1 level to test this properly.
- [ ] Same file: key-bag selection prefers a shrouded key bag but silently
  drops any unshrouded key bags present alongside it without counting them
  toward the "more than one key" check. Pre-existing, low risk (Apple's
  portal doesn't export mixed bag types), but worth a defensive fix.

## Minor cleanup

- [ ] `lib/pdf.ts`'s `canvas as unknown as HTMLCanvasElement` cast (used to
  satisfy `pdfjs-dist`'s `page.render()` typing with `@napi-rs/canvas`) has
  no comment explaining why it's safe. Add one pointing at pdfjs's actual
  runtime contract (it only calls `.getContext('2d', ...)` on the object,
  confirmed against the installed `pdfjs-dist@6.2.108` source) so a future
  editor doesn't "fix" it by trying to satisfy the DOM type properly and
  break rendering.
- [ ] `lib/structure.ts`: transport-level failures (non-OK HTTP response,
  missing `message.content`) throw a plain `Error`, not a
  `StructuringError`, so they don't carry `rawText`. Acceptable today since
  `app/api/extract/route.ts` has a generic 500 fallback for non-
  `StructuringError` errors, but a uniform error shape across all failure
  modes would be cleaner for the client.
