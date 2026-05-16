function hexEncode(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexDecode(hex: string): Uint8Array {
  const pairs = hex.match(/.{2}/g) ?? [];
  return new Uint8Array(pairs.map((b) => parseInt(b, 16)));
}

async function pbkdf2Key(input: string, salt: Uint8Array): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(input),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, hash: 'SHA-256', iterations: 100_000 },
    keyMaterial,
    256
  );
  return hexEncode(bits);
}

export async function hashWithSalt(input: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Key(input, salt);
  return { hash, salt: hexEncode(salt.buffer as ArrayBuffer) };
}

export async function verifyWithSalt(input: string, storedHash: string, storedSalt: string): Promise<boolean> {
  const hash = await pbkdf2Key(input, hexDecode(storedSalt));
  return hash === storedHash;
}

// Solo para verificar hashes legacy (SHA-256 sin sal) — no usar para nuevos hashes
export async function legacyHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return hexEncode(buf);
}
