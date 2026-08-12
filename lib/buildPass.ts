// lib/buildPass.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import forge from "node-forge";
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

/**
 * passkit-generator (v3.5.7, the installed version) expects the signing
 * certificate and its private key as two separate PEM blobs
 * (`signerCert` + `signerKey`), decrypting `signerKey` internally via
 * node-forge's `pki.decryptRsaPrivateKey`. It does NOT accept a combined
 * .p12/.pfx buffer directly, even though that's the format Apple's
 * developer portal exports and what `signerCert` was originally assumed to
 * be here.
 *
 * To keep a single `APPLE_PASS_CERT_BASE64` (.p12) + `APPLE_PASS_CERT_PASSPHRASE`
 * env var pair, we unpack the .p12 ourselves with node-forge (already a
 * transitive dependency of passkit-generator, which uses it internally for
 * this exact PKCS#7 signing step) and hand passkit-generator the resulting
 * PEM certificate and PEM private key.
 */
function extractCertAndKeyFromP12(
  p12Buffer: Buffer,
  passphrase: string
): { signerCert: Buffer; signerKey: Buffer } {
  const p12Asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString("binary")));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, passphrase);

  const certBag = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) {
    throw new Error("No certificate found in APPLE_PASS_CERT_BASE64 (.p12) contents");
  }

  const shroudedKeyBag = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
    forge.pki.oids.pkcs8ShroudedKeyBag
  ]?.[0];
  const keyBag =
    shroudedKeyBag ?? p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag]?.[0];
  if (!keyBag?.key) {
    throw new Error("No private key found in APPLE_PASS_CERT_BASE64 (.p12) contents");
  }

  return {
    signerCert: Buffer.from(forge.pki.certificateToPem(certBag.cert), "utf-8"),
    signerKey: Buffer.from(forge.pki.privateKeyToPem(keyBag.key), "utf-8"),
  };
}

export async function buildPass(data: PassData): Promise<Buffer> {
  const icons = await loadIcons();
  const passTypeIdentifier = requireEnv("APPLE_PASS_TYPE_IDENTIFIER");
  const teamIdentifier = requireEnv("APPLE_TEAM_IDENTIFIER");
  const wwdr = Buffer.from(requireEnv("APPLE_WWDR_CERT_BASE64"), "base64");
  const p12 = Buffer.from(requireEnv("APPLE_PASS_CERT_BASE64"), "base64");
  const passphrase = requireEnv("APPLE_PASS_CERT_PASSPHRASE");
  const { signerCert, signerKey } = extractCertAndKeyFromP12(p12, passphrase);

  // passkit-generator strips any keys from the constructor's `props` argument
  // that aren't part of its `OverridablePassProps` type (which excludes
  // barcode and pass-style structure fields), so `barcodes` and the
  // style-specific structure (e.g. `generic`) from `mapPassDataToPassJson`
  // must be supplied as part of a `pass.json` buffer instead of via `props`.
  const passJson = {
    ...mapPassDataToPassJson(data),
    formatVersion: 1,
    passTypeIdentifier,
    teamIdentifier,
    serialNumber: randomUUID(),
  };

  const pass = new PKPass(
    {
      ...icons,
      "pass.json": Buffer.from(JSON.stringify(passJson), "utf-8"),
    },
    { wwdr, signerCert, signerKey }
  );

  return pass.getAsBuffer();
}
