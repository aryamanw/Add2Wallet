# Product

## Register

product

## Users

A single owner-operator (not a multi-user product) — password-gated,
personal tool used by one person on their own devices. Primary context:
receiving a ticket, coupon, membership card, or confirmation as a PDF or
photo, and wanting it in Apple Wallet within seconds. Likely used on an
iPhone in Safari (the "Add to Wallet" sheet is iOS-native), but uploads can
also happen from a desktop browser. Sessions are short and infrequent —
open, upload, review, done. No onboarding, no learning curve tolerance:
every screen must be immediately legible on first use since there's no
accumulated familiarity from daily use.

## Product Purpose

Turns an uploaded document (ticket, coupon, membership card, confirmation
screenshot) into a signed `.pkpass` file the user can add to Apple Wallet.
Pipeline: upload → text extraction (embedded PDF text or OCR) → LLM
structuring into pass fields → editable review → sign → download. Success
looks like: the extracted fields are trustworthy enough that the user
rarely needs to correct them, and when they do, the review screen makes
that fast and low-anxiety — especially for barcode value and dates, which
are the fields most costly to get wrong (a wrong barcode means a pass that
doesn't work at the gate).

## Brand Personality

Minimal and efficient. Utilitarian in the best sense — fast, quiet,
confidence-inspiring, gets out of the way. Closer to a well-made CLI
wrapped in UI (Raycast, Linear) than to consumer app polish or enterprise
software. No decorative flourishes competing with the task. The one place
personality is allowed to show a little is the review screen's pass
preview — it's the emotional payoff of the flow (this is what's about to
land in your Wallet) and can afford a touch more visual craft than the
utilitarian chrome around it.

## Anti-references

No specific anti-references named. By inference from the personality
above: avoid SaaS-marketing visual tropes (hero gradients, big rounded
cards with icon+heading+text, dashboard-chrome for a 3-screen tool),
anything that reads as consumer-app cute, and anything that adds visual
weight without adding clarity — this is a tool used in short, task-focused
bursts, not lingered in.

## Design Principles

- **Speed over ceremony.** Every screen exists to move the user one step
  closer to a downloaded pass. No unnecessary chrome, empty states, or
  friction that doesn't serve extraction accuracy or field correctness.
- **Trust the numbers, verify the details.** The whole app hinges on a
  document being read correctly. Fields most likely to be wrong (barcode,
  dates) should be the most visually emphasized on the review screen, not
  buried among the rest.
- **Errors are first-class, not swallowed.** Upload failures, LLM
  structuring failures, and signing failures each need a clear, specific
  message with a next step — never a silent failure or generic "something
  went wrong."
- **One user, no chrome for others.** No multi-user affordances, no
  settings sprawl, no navigation for screens that don't exist. Three
  screens (login, upload, review) is the whole app; design should keep it
  feeling that small.
- **The pass preview is the reward.** The review screen's rendering of the
  actual Wallet pass (style, colors, fields) is the moment of payoff in
  the flow and is the one place worth extra visual craft.

## Accessibility & Inclusion

Baseline WCAG AA hygiene: sufficient color contrast, full keyboard
navigation, visible focus states, no motion-only or color-only status
cues (error/success states need text or icon, not color alone). No
additional user-specific accommodations identified.
