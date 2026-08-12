// lib/buildPass.test.ts
import { afterEach, describe, expect, it, vi } from "vitest";
import forge from "node-forge";
import { buildPass } from "./buildPass";
import type { PassData } from "./passSchema";

const validPassData: PassData = {
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

const PASSPHRASE = "test-passphrase";

/** Generates a self-signed certificate + its keypair, entirely synthetic (no real Apple cert needed). */
function generateSelfSignedCert() {
  const keys = forge.pki.rsa.generateKeyPair(512);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const attrs = [{ name: "commonName", value: "Add2Wallet Test" }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  return { cert, keys };
}

function p12ToBase64(p12Asn1: forge.asn1.Asn1): string {
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, "binary").toString("base64");
}

function setCertEnv(certBase64: string) {
  process.env.APPLE_PASS_TYPE_IDENTIFIER = "pass.com.add2wallet.test";
  process.env.APPLE_TEAM_IDENTIFIER = "TEAMID1234";
  const { cert: wwdrCert } = generateSelfSignedCert();
  process.env.APPLE_WWDR_CERT_BASE64 = Buffer.from(forge.pki.certificateToPem(wwdrCert), "utf-8").toString(
    "base64"
  );
  process.env.APPLE_PASS_CERT_BASE64 = certBase64;
  process.env.APPLE_PASS_CERT_PASSPHRASE = PASSPHRASE;
}

afterEach(() => {
  delete process.env.APPLE_PASS_TYPE_IDENTIFIER;
  delete process.env.APPLE_TEAM_IDENTIFIER;
  delete process.env.APPLE_WWDR_CERT_BASE64;
  delete process.env.APPLE_PASS_CERT_BASE64;
  delete process.env.APPLE_PASS_CERT_PASSPHRASE;
  vi.restoreAllMocks();
});

describe("buildPass .p12 handling", () => {
  it("throws a clear error when the .p12 contains more than one certificate", async () => {
    const { cert: cert1, keys } = generateSelfSignedCert();
    const { cert: cert2 } = generateSelfSignedCert();

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert1, cert2], PASSPHRASE, {
      algorithm: "3des",
    });
    setCertEnv(p12ToBase64(p12Asn1));

    await expect(buildPass(validPassData)).rejects.toThrow(
      /Found 2 certificates in APPLE_PASS_CERT_BASE64/
    );
  });

  it("builds a signed .pkpass buffer from a .p12 with exactly one certificate and key", async () => {
    const { cert, keys } = generateSelfSignedCert();
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, PASSPHRASE, {
      algorithm: "3des",
    });
    setCertEnv(p12ToBase64(p12Asn1));

    const result = await buildPass(validPassData);

    expect(Buffer.isBuffer(result)).toBe(true);
    // .pkpass files are zip archives; zip local file headers start with "PK".
    expect(result.subarray(0, 2).toString("utf-8")).toBe("PK");
  });
});
