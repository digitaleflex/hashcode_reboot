/**
 * Chiffrement Web Crypto pour localStorage.
 *
 * Utilise AES-GCM avec une clé dérivée via PBKDF2. La clé est stockée
 * dans sessionStorage (donc effacée à la fermeture de l'onglet).
 *
 * Format stockage : base64(iv | ciphertext | tag)
 */

const SALT_KEY = "hashcode:reboot:salt";
const ENC_PREFIX = "enc:";

function getSessionKey(): string {
  if (typeof window === "undefined") return "ssr-fallback-key-do-not-use";
  let key = sessionStorage.getItem(SALT_KEY);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(SALT_KEY, key);
  }
  return key;
}

async function getCryptoKey(): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passphrase = getSessionKey();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase.padEnd(32, "0").slice(0, 32)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode("hashcode-reboot-salt"),
      iterations: 1000,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(s: string): ArrayBuffer {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export async function encrypt(value: string): Promise<string> {
  if (typeof window === "undefined") return value;
  try {
    const key = await getCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(value),
    );
    return ENC_PREFIX + toBase64(iv.buffer) + ":" + toBase64(ciphertext);
  } catch {
    return value;
  }
}

export async function decrypt(value: string): Promise<string> {
  if (typeof window === "undefined") return value;
  if (!value.startsWith(ENC_PREFIX)) return value;
  try {
    const key = await getCryptoKey();
    const payload = value.slice(ENC_PREFIX.length);
    const [ivB64, ctB64] = payload.split(":");
    if (!ivB64 || !ctB64) return "";
    const iv = new Uint8Array(fromBase64(ivB64));
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      fromBase64(ctB64),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return "";
  }
}

export async function setEncryptedItem(key: string, value: string): Promise<void> {
  if (typeof window === "undefined") return;
  const encrypted = await encrypt(value);
  localStorage.setItem(key, encrypted);
}

export async function getEncryptedItem(key: string): Promise<string | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  return await decrypt(raw);
}

export async function removeEncryptedItem(key: string): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key);
}
