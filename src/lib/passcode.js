const { scrypt, randomBytes, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");

const scryptAsync = promisify(scrypt);

/**
 * OWASP-recommended scrypt parameters for resource-conscious / serverless interactive auth:
 * - N = 32768 (2^15 CPU/memory cost, ~32MB RAM)
 * - r = 8 (block size)
 * - p = 1 (parallelization)
 * - keylen = 32 (256-bit derived key)
 * - saltLen = 16 (128-bit random salt)
 */
const SCRYPT_PARAMS = {
  N: 32768,
  r: 8,
  p: 1,
  keylen: 32,
  saltLen: 16,
};

/**
 * Generate a secure scrypt hash of a passcode with a unique random salt.
 * Output format: $scrypt$N=32768,r=8,p=1$<salt_base64url>$<derivedKey_base64url>
 * @param {string} passcode
 * @returns {Promise<string>}
 */
async function hashPasscode(passcode) {
  const salt = randomBytes(SCRYPT_PARAMS.saltLen);
  const derivedKey = /** @type {Buffer} */ (
    await scryptAsync(passcode, salt, SCRYPT_PARAMS.keylen, {
      N: SCRYPT_PARAMS.N,
      r: SCRYPT_PARAMS.r,
      p: SCRYPT_PARAMS.p,
      maxmem: 64 * 1024 * 1024,
    })
  );

  const saltB64 = salt.toString("base64url");
  const keyB64 = derivedKey.toString("base64url");

  return `$scrypt$N=${SCRYPT_PARAMS.N},r=${SCRYPT_PARAMS.r},p=${SCRYPT_PARAMS.p}$${saltB64}$${keyB64}`;
}

/**
 * Verify a candidate passcode against a formatted scrypt hash string.
 * Employs timingSafeEqual to prevent timing attacks.
 * @param {string} passcode
 * @param {string} hashStr
 * @returns {Promise<boolean>}
 */
async function verifyPasscode(passcode, hashStr) {
  if (!passcode || !hashStr || typeof hashStr !== "string") return false;

  try {
    const parts = hashStr.split("$");
    // Format: ["", "scrypt", "N=32768,r=8,p=1", saltB64, keyB64]
    if (parts.length !== 5 || parts[1] !== "scrypt") return false;

    const paramPairs = parts[2].split(",");
    /** @type {Record<string, number>} */
    const params = {};
    for (const pair of paramPairs) {
      const [k, v] = pair.split("=");
      if (!k || !v || !/^\d+$/.test(v)) return false;
      params[k] = Number.parseInt(v, 10);
    }

    const { N, r, p } = params;
    if (!N || !r || !p || N <= 1 || r <= 0 || p <= 0) return false;

    const salt = Buffer.from(parts[3], "base64url");
    const expectedKey = Buffer.from(parts[4], "base64url");

    if (salt.length === 0 || expectedKey.length === 0) return false;

    const derivedKey = /** @type {Buffer} */ (
      await scryptAsync(passcode, salt, expectedKey.length, {
        N,
        r,
        p,
        maxmem: 64 * 1024 * 1024,
      })
    );

    if (derivedKey.length !== expectedKey.length) return false;

    return timingSafeEqual(derivedKey, expectedKey);
  } catch {
    return false;
  }
}

module.exports = {
  SCRYPT_PARAMS,
  hashPasscode,
  verifyPasscode,
};
