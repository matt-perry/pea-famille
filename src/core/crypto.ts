/**
 * Chiffrement des fichiers de cours publiés sur GitHub (AES-256-GCM).
 * La même clé (DATA_KEY) est connue du robot (secret GitHub) et de l'app (sur l'iPhone).
 * Fonctionne dans le navigateur comme dans Node (Web Crypto).
 */

export interface EncryptedPayload {
  v: 1;
  alg: 'AES-GCM';
  iv: string;
  data: string;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Nouvelle clé aléatoire de 256 bits, en base64 (44 caractères). */
export function generateDataKey(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

export function isValidDataKey(key: string): boolean {
  try {
    return base64ToBytes(key).length === 32;
  } catch {
    return false;
  }
}

async function importKey(keyB64: string): Promise<CryptoKey> {
  const raw = base64ToBytes(keyB64);
  if (raw.length !== 32) throw new Error('Clé de données invalide (256 bits attendus).');
  return crypto.subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(value: unknown, keyB64: string): Promise<EncryptedPayload> {
  const key = await importKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  return { v: 1, alg: 'AES-GCM', iv: bytesToBase64(iv), data: bytesToBase64(cipher) };
}

export async function decryptJSON<T>(payload: EncryptedPayload, keyB64: string): Promise<T> {
  if (payload?.v !== 1 || payload.alg !== 'AES-GCM') throw new Error('Format de fichier chiffré inconnu.');
  const key = await importKey(keyB64);
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) as BufferSource },
    key,
    base64ToBytes(payload.data) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

/** Nom du fichier de cours d'un symbole (data/prices/<nom>). */
export function priceFileName(symbol: string): string {
  return `${symbol.replace(/[^A-Za-z0-9._-]/g, '_')}.json`;
}

/** Contenu déchiffré d'un fichier de cours. */
export interface PriceFile {
  symbol: string;
  currency: string;
  source: string;
  updatedAt: string;
  /** [date, clôture, clôture ajustée] */
  bars: [string, number, number | null][];
}
