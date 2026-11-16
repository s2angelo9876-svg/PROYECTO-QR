// Genera archivos WAV de tonos para los efectos de sonido del demo
// Ejecutar con: node scripts/generate-sounds.js
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'public', 'sounds');

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function generateTone(frequency, duration, type = 'sine', volume = 0.5) {
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // Header WAV
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    let sample = 0;
    if (type === 'sine') sample = Math.sin(2 * Math.PI * frequency * t);
    else if (type === 'square') sample = Math.sign(Math.sin(2 * Math.PI * frequency * t));
    else if (type === 'sawtooth') sample = 2 * ((frequency * t) % 1) - 1;

    const envelope = Math.min(1, t * 20) * Math.min(1, (duration - t) * 20);
    const value = Math.floor(sample * volume * envelope * 32767);
    buffer.writeInt16LE(value, 44 + i * 2);
  }
  return buffer;
}

function generateTwoTone(f1, f2, gap, duration, type, volume) {
  return Buffer.concat([
    generateTone(f1, duration, type, volume),
    Buffer.alloc(Math.floor(SAMPLE_RATE * gap * 0.001)),
    generateTone(f2, duration, type, volume),
  ]);
}

try {
  // success: tono agudo ascendente
  fs.writeFileSync(path.join(OUT_DIR, 'success.wav'), generateTwoTone(880, 1320, 80, 0.15, 'sine', 0.4));
  // warning: tono medio doble
  fs.writeFileSync(path.join(OUT_DIR, 'warning.wav'), generateTwoTone(660, 660, 100, 0.2, 'square', 0.3));
  // error: tono grave descendente
  fs.writeFileSync(path.join(OUT_DIR, 'error.wav'), generateTwoTone(440, 220, 80, 0.25, 'sawtooth', 0.4));
  console.log('✓ Sonidos generados en public/sounds/');
} catch (err) {
  console.error('Error generando sonidos:', err);
}
