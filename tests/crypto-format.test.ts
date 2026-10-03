import { describe, expect, it } from 'vitest';
import {
  decryptJSON,
  encryptJSON,
  formatDateShort,
  formatEUR,
  formatEURApprox,
  formatPct,
  generateDataKey,
  isValidDataKey,
  parseDecimal,
} from '../src/core';

const plain = (s: string) => s.replace(/\s/g, ' ');

describe('chiffrement des fichiers de cours', () => {
  it('chiffre puis déchiffre', async () => {
    const key = generateDataKey();
    expect(isValidDataKey(key)).toBe(true);
    const payload = await encryptJSON({ symbol: 'DCAM.PA', bars: [['2026-10-02', 6.308, 6.308]] }, key);
    expect(JSON.stringify(payload)).not.toContain('DCAM');
    expect(await decryptJSON(payload, key)).toEqual({ symbol: 'DCAM.PA', bars: [['2026-10-02', 6.308, 6.308]] });
  });

  it('refuse une mauvaise clé', async () => {
    const payload = await encryptJSON({ a: 1 }, generateDataKey());
    await expect(decryptJSON(payload, generateDataKey())).rejects.toThrow();
  });
});

describe('formats français', () => {
  it('formate les montants', () => {
    expect(plain(formatEUR(42350))).toBe('42 350 €');
    expect(plain(formatEUR(124, { signed: true }))).toBe('+124 €');
    expect(plain(formatEUR(-31.5, { decimals: 2 }))).toBe('-31,50 €');
    expect(formatEUR(null)).toBe('—');
    expect(plain(formatEURApprox(821991))).toBe('≈ 822 000 €');
  });

  it('formate les pourcentages', () => {
    expect(plain(formatPct(0.0029))).toBe('+0,29 %');
    expect(plain(formatPct(0.178, { decimals: 1 }))).toBe('+17,8 %');
  });

  it('formate les dates', () => {
    expect(formatDateShort('2026-10-02')).toBe('ven. 2 oct.');
  });

  it('lit les saisies françaises', () => {
    expect(parseDecimal('6,31')!.toString()).toBe('6.31');
    expect(parseDecimal('1 234,56 €')!.toString()).toBe('1234.56');
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('')).toBeNull();
  });
});
