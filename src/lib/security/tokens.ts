/**
 * Edge-compatible cryptographic session token and password management.
 * Built using native Web Crypto API (supported in Node.js 18+ and Next.js Edge Runtime).
 */

export interface SessionPayload {
  sub: string; // User ID
  email: string; // User Email
  role: string; // Role (ADMIN, OPERATOR, FINANCIAL, VIEWER)
  name: string; // User Name
  companyId?: string;
  exp: number; // Expiration epoch in seconds
  iat: number; // Issued epoch in seconds
}

export const SESSION_COOKIE_NAME = "invoice_session";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(base64url: string): Uint8Array<ArrayBuffer> {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(): Promise<CryptoKey> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET não está configurada. Defina essa variável de ambiente antes de emitir ou validar sessões."
    );
  }
  const secretHash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey(
    "raw",
    secretHash,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token.
 */
export async function createSessionToken(
  payload: Omit<SessionPayload, "exp" | "iat">,
  expiresInSeconds: number = 7 * 24 * 3600 // 7 days
): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSeconds;
  const fullPayload: SessionPayload = {
    ...payload,
    iat,
    exp,
  };

  const payloadJson = JSON.stringify(fullPayload);
  const payloadB64 = toBase64Url(encoder.encode(payloadJson));

  const key = await getHmacKey();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadB64)
  );
  const signatureB64 = toBase64Url(signatureBuffer);

  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verifies the HMAC-SHA256 signature and expiration of a session token.
 */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [payloadB64, signatureB64] = parts;
    const key = await getHmacKey();
    const signatureBytes = fromBase64Url(signatureB64);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes as BufferSource,
      encoder.encode(payloadB64)
    );

    if (!isValid) return null;

    const payloadJson = decoder.decode(fromBase64Url(payloadB64));
    const payload: SessionPayload = JSON.parse(payloadJson);

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Generates a cryptographically random password (used to bootstrap the
 * admin account when no ADMIN_INITIAL_PASSWORD is configured).
 */
export function generateRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return toBase64Url(bytes);
}

/**
 * Hashes a password using PBKDF2 with SHA-512 (100,000 iterations).
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const iterations = 100000;
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-512",
    },
    keyMaterial,
    512
  );

  const hashHex = Array.from(new Uint8Array(derivedBits))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `pbkdf2:sha512:${iterations}:${saltHex}:${hashHex}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash using constant-time comparison.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    if (!storedHash || !password) return false;
    const parts = storedHash.split(":");
    if (parts.length !== 5) return false;

    const [algorithm, hashType, iterationsStr, saltHex, originalHashHex] = parts;
    if (algorithm !== "pbkdf2" || hashType !== "sha512") return false;

    const iterations = parseInt(iterationsStr, 10);
    const saltBytes = new Uint8Array(
      saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveBits"]
    );

    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: saltBytes as BufferSource,
        iterations,
        hash: "SHA-512",
      },
      keyMaterial,
      512
    );

    const recomputedHashHex = Array.from(new Uint8Array(derivedBits))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    if (recomputedHashHex.length !== originalHashHex.length) return false;
    let diff = 0;
    for (let i = 0; i < recomputedHashHex.length; i++) {
      diff |= recomputedHashHex.charCodeAt(i) ^ originalHashHex.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}
