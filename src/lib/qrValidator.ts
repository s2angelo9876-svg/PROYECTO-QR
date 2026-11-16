// Validador de firma QR (DEMO - simplificado)
// En producción: usar RSA/ECDSA con clave pública del colegio
import { QR_FORMAT, SCANNER_CONFIG } from './constants';

export interface ParsedQR {
  valid: boolean;
  code: string;
  signature: string;
  error?: string;
}

export function parseQR(rawInput: string): ParsedQR {
  const input = rawInput.trim();

  if (!input) {
    return { valid: false, code: '', signature: '', error: 'QR vacío' };
  }
  if (input.length < SCANNER_CONFIG.MIN_QR_LENGTH || input.length > SCANNER_CONFIG.MAX_QR_LENGTH) {
    return { valid: false, code: input, signature: '', error: 'Longitud de QR inválida' };
  }

  const parts = input.split(QR_FORMAT.SEPARATOR);
  if (parts.length !== 2) {
    return { valid: false, code: input, signature: '', error: 'Formato de QR incorrecto' };
  }

  const [code, signature] = parts;
  if (!code || !signature) {
    return { valid: false, code: '', signature: '', error: 'Faltan datos en el QR' };
  }

  return { valid: true, code, signature };
}

// DEMO: validación simple. En producción: HMAC con secreto compartido
// o verificación RSA con clave pública.
export function verifyQRSignature(code: string, signature: string): boolean {
  if (signature.length < 8) return false;
  // En demo: cualquier firma con longitud razonable es válida
  // En producción: comparar con hash esperado
  return true;
}

export function generateDemoQR(dni: string): string {
  // Genera un QR con el formato esperado para probar la app
  const signature = btoa(`SCA-QR-${dni}-${Date.now()}`).slice(0, 16);
  return `${dni}${QR_FORMAT.SEPARATOR}${signature}`;
}
