import { describe, it, expect } from 'vitest';
import { parseQR, verifyQRSignature, generateDemoQR } from '@/lib/qrValidator';

describe('qrValidator', () => {
  it('parsea un QR con formato válido', () => {
    const result = parseQR('72345678|abc12345');
    expect(result.valid).toBe(true);
    expect(result.code).toBe('72345678');
    expect(result.signature).toBe('abc12345');
  });

  it('rechaza QR sin separador', () => {
    const result = parseQR('72345678-sin-separador');
    expect(result.valid).toBe(false);
  });

  it('rechaza QR muy corto', () => {
    const result = parseQR('12|ab');
    expect(result.valid).toBe(false);
  });

  it('rechaza QR vacío', () => {
    const result = parseQR('');
    expect(result.valid).toBe(false);
  });

  it('genera QR demo con formato correcto', () => {
    const qr = generateDemoQR('72345678');
    expect(qr).toContain('72345678');
    expect(qr).toContain('|');
  });

  it('verifica firma con longitud suficiente', () => {
    expect(verifyQRSignature('code', 'firma-valida-larga')).toBe(true);
    expect(verifyQRSignature('code', 'abc')).toBe(false);
  });
});
