/**
 * Server-only helpers: image bytes, perceptual hashing (for duplicate photo
 * detection) and a signed analysis token so the browser cannot forge an
 * AI verdict when it submits the report.
 */
import jpeg from "jpeg-js";

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  const base64 = comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function sha256Hex(input: string | Uint8Array): Promise<string> {
  const data = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 64-bit average hash of a JPEG. Two photos of the same scene land within a
 * few bits of each other, which is what duplicate detection compares.
 */
export function averageHash(jpegBytes: Uint8Array): string {
  try {
    const raw = jpeg.decode(jpegBytes, { useTArray: true, maxMemoryUsageInMB: 256 });
    const { width, height, data } = raw;
    if (!width || !height) return "";
    const cells = new Array<number>(64).fill(0);
    const counts = new Array<number>(64).fill(0);
    for (let y = 0; y < height; y++) {
      const gy = Math.min(7, Math.floor((y / height) * 8));
      for (let x = 0; x < width; x++) {
        const gx = Math.min(7, Math.floor((x / width) * 8));
        const i = (y * width + x) * 4;
        const gray = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
        const cell = gy * 8 + gx;
        cells[cell] = cells[cell]! + gray;
        counts[cell] = counts[cell]! + 1;
      }
    }
    const means = cells.map((sum, i) => (counts[i] ? sum / counts[i]! : 0));
    const overall = means.reduce((a, b) => a + b, 0) / 64;
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      let nibble = 0;
      for (let b = 0; b < 4; b++) nibble = (nibble << 1) | (means[i + b]! > overall ? 1 : 0);
      hex += nibble.toString(16);
    }
    return hex;
  } catch (error) {
    console.error("[image-hash] could not hash photo", error);
    return "";
  }
}

function signingSecret(): string {
  const secret =
    process.env["LOVABLE_API_KEY"] ??
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_URL"];
  if (!secret) throw new Error("Server is not configured to validate reports.");
  return secret;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Signs a validation payload so it can travel through the browser untampered. */
export async function signPayload(payload: unknown): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyPayload<T>(token: string): Promise<T> {
  const [body, sig] = token.split(".");
  if (!body || !sig)
    throw new Error("This report could not be validated. Please retake the photo.");
  const ok = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(),
    fromBase64Url(sig) as BufferSource,
    new TextEncoder().encode(body),
  );
  if (!ok) throw new Error("This report could not be validated. Please retake the photo.");
  return JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as T;
}
