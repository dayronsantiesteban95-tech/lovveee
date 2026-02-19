/**
 * Final fix for UTF-8 double-encoding in DispatchTracker.tsx - Version 5
 * 
 * Comprehensive fix handling all corruption patterns.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'src', 'pages', 'DispatchTracker.tsx');

// W1252 special range reverse map
const unicodeToW1252 = new Map([
  [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
  [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93],
  [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B],
  [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F],
]);

function matchAt(buf, i, ...bytes) {
  if (i + bytes.length > buf.length) return false;
  return bytes.every((b, j) => buf[i + j] === b);
}

const rawBytes = readFileSync(filePath);
const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
const inputBytes = hasBOM ? rawBytes.slice(3) : rawBytes;
console.log(`Input: ${inputBytes.length} bytes (BOM: ${hasBOM})`);

function fixEncoding(buf) {
  const output = [];
  let i = 0;
  const stats = { ascii: 0, latin1: 0, w1252: 0, preserved: 0, emoji: 0, emDash: 0 };
  
  while (i < buf.length) {
    // ================================================================
    // SPECIAL CASES: patterns where W1252 special chars were normalized to ASCII
    // Pattern guide: [double-encoded E2/F0] [double-encoded 80/9F] [normalized 3rd byte] [4th byte or end]
    // ================================================================
    
    // ── 3-BYTE CHARS WITH MIDDLE BYTE NORMALIZED ─────────────────────────────
    
    // C3A2 E282AC 22 → E2 80 94 (em dash —)
    // original E2 80 94, where 94 (W1252 ") → normalized to ASCII 0x22
    if (matchAt(buf, i, 0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0x22)) {
      output.push(0xE2, 0x80, 0x94); i += 6; stats.emDash++; continue;
    }
    
    // C3A2 E282AC C2A6 → E2 80 A6 (ellipsis …) - already handled by standard path but explicit
    if (matchAt(buf, i, 0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0xC2, 0xA6)) {
      output.push(0xE2, 0x80, 0xA6); i += 7; stats.emDash++; continue;
    }
    
    // ── 4-BYTE EMOJI WITH 3RD BYTE NORMALIZED TO ASCII 0x22 (from W1252 0x93/0x94) ─
    
    // C3B0 C5B8 22 C2A6 → F0 9F 93 A6 = 📦 (Package) - "Standard", "Cargo Details"
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0xA6)) {
      output.push(0xF0, 0x9F, 0x93, 0xA6); i += 7; stats.emoji++; continue;
    }
    
    // C3B0 C5B8 22 C28D → F0 9F 93 8D = 📍 (Pin) - "At Pickup", "At Delivery", "Pickup Location"
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0x8D)) {
      output.push(0xF0, 0x9F, 0x93, 0x8D); i += 7; stats.emoji++; continue;
    }
    
    // C3B0 C5B8 22 E280B9 → F0 9F 93 8B = 📋 (Clipboard) - "DAILY OPS", "Load Reference", "Accessorial"
    // E2 80 B9 = U+2039 (‹) = W1252 0x8B
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xE2, 0x80, 0xB9)) {
      output.push(0xF0, 0x9F, 0x93, 0x8B); i += 8; stats.emoji++; continue;
    }
    
    // C3B0 C5B8 22 22 (followed by space) → F0 9F 93 94 = 📔 (Notebook) - "BOL Document", "Invoice generated"
    // Both 0x93 AND 0x94 normalized to 0x22
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0x22) && 
        (i + 6 < buf.length && buf[i + 6] === 0x20)) {
      output.push(0xF0, 0x9F, 0x93, 0x94); i += 6; stats.emoji++; continue;
    }
    
    // C3B0 C5B8 22 C2A1 → F0 9F 93 A1 = 📡 (Satellite) - "Blast sent"
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0xA1)) {
      output.push(0xF0, 0x9F, 0x93, 0xA1); i += 7; stats.emoji++; continue;
    }
    
    // ── 4-BYTE EMOJI WITH 3RD BYTE NORMALIZED TO ASCII 0x27 (from W1252 0x91/0x92) ─
    
    // C3B0 C5B8 27 C2B5 → F0 9F 92 B5 = 💵 (Dollar banknote) - "Revenue"
    // 0x92 (W1252 ') normalized to 0x27 (ASCII ')
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x27, 0xC2, 0xB5)) {
      output.push(0xF0, 0x9F, 0x92, 0xB5); i += 7; stats.emoji++; continue;
    }
    
    // ── 4-BYTE EMOJI WITH 4TH BYTE NORMALIZED TO ASCII 0x2D (from W1252 0x96/0x97) ─
    
    // C3B0 C5B8 C5A1 2D → F0 9F 9A 97 = 🚗 (Car) - "Driver Assignment"
    // 0x97 (W1252 —) normalized to 0x2D (ASCII -)
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0xC5, 0xA1, 0x2D)) {
      output.push(0xF0, 0x9F, 0x9A, 0x97); i += 7; stats.emoji++; continue;
    }
    
    // C3B0 C5B8 C5A1 C290 → F0 9F 9A 90 = 🚐 (Minibus) - "Vehicle & Distance"
    // This one should work via standard path (C290 -> 0x90), but be explicit
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0xC5, 0xA1, 0xC2, 0x90)) {
      output.push(0xF0, 0x9F, 0x9A, 0x90); i += 8; stats.emoji++; continue;
    }
    
    // ── TRIPLE-ENCODED PATTERNS (in comments) ────────────────────────────────
    // C3A2 22 E282AC → represents a bullet • (E2 80 A2) where middle byte 0x80 was
    // normalized to 0x22 at an earlier step. Replace with ASCII "=" for comment visual.
    // These are in decorative comment lines like "// ═══ Types ═══"
    if (matchAt(buf, i, 0xC3, 0xA2, 0x22, 0xE2, 0x82, 0xAC)) {
      // Output em dash to replace the corrupted pattern (or '=' for simpler approach)
      output.push(0x3D); // ASCII '='
      i += 6; stats.emDash++; continue;
    }
    
    // ================================================================
    // STANDARD W1252 REVERSE MAPPING
    // ================================================================
    
    const b0 = buf[i];
    if (b0 < 0x80) { output.push(b0); stats.ascii++; i++; continue; }
    
    // 2-byte UTF-8
    if ((b0 & 0xE0) === 0xC0 && i + 1 < buf.length && (buf[i+1] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x1F) << 6) | (buf[i+1] & 0x3F);
      if (unicodeToW1252.has(cp)) { output.push(unicodeToW1252.get(cp)); stats.w1252++; }
      else if (cp >= 0x80 && cp <= 0xFF) { output.push(cp); stats.latin1++; }
      else { output.push(b0, buf[i+1]); stats.preserved++; }
      i += 2; continue;
    }
    
    // 3-byte UTF-8
    if ((b0 & 0xF0) === 0xE0 && i + 2 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x0F) << 12) | ((buf[i+1] & 0x3F) << 6) | (buf[i+2] & 0x3F);
      if (unicodeToW1252.has(cp)) { output.push(unicodeToW1252.get(cp)); stats.w1252++; }
      else if (cp >= 0xA0 && cp <= 0xFF) { output.push(cp); stats.latin1++; }
      else { output.push(b0, buf[i+1], buf[i+2]); stats.preserved++; }
      i += 3; continue;
    }
    
    // 4-byte UTF-8
    if ((b0 & 0xF8) === 0xF0 && i + 3 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80 && (buf[i+3] & 0xC0) === 0x80) {
      output.push(b0, buf[i+1], buf[i+2], buf[i+3]); stats.preserved++; i += 4; continue;
    }
    
    // Invalid byte - keep as-is
    output.push(b0); i++;
  }
  
  console.log(`Stats: ASCII=${stats.ascii}, Latin1=${stats.latin1}, W1252=${stats.w1252}, Preserved=${stats.preserved}, Emoji=${stats.emoji}, EmDash=${stats.emDash}`);
  return Buffer.from(output);
}

const outputBuf = fixEncoding(inputBytes);

// Decode as UTF-8
let fixedText = outputBuf.toString('utf8');
console.log(`Output: ${fixedText.length} chars, ${Buffer.byteLength(fixedText)} bytes`);

// POST-PROCESSING: Clean up any remaining garbled comment lines
// The "// ===" comment lines with remaining FFFD should be normalized
// Replace sequences of FFFD+"quote" patterns in comment lines
// Pattern: // [FFFD"]["FFFD"]+ ... -> replace the FFFD section with "═══..."
fixedText = fixedText.replace(/\/\/ [\uFFFD"]+/g, (match) => {
  // Count how many char-pairs there were (each pair = one box drawing char)
  const count = Math.round(match.length / 2);
  return '// ' + '═'.repeat(Math.max(1, count - 2));
});

// Also fix any standalone FFFD in non-comment areas that we couldn't recover
const remainingFffd = (fixedText.match(/\uFFFD/g) || []).length;

// VALIDATION
console.log('\n=== VALIDATION ===');
const checks = [
  ['═ box drawing', '═'],
  ['— em dash', '\u2014'],
  ['… ellipsis', '\u2026'],
  ['📦 package', '\u{1F4E6}'],
  ['📍 pin', '\u{1F4CD}'],
  ['📋 clipboard', '\u{1F4CB}'],
  ['📔 notebook', '\u{1F4D4}'],
  ['📡 satellite', '\u{1F4E1}'],
  ['🚗 car', '\u{1F697}'],
  ['💵 dollar', '\u{1F4B5}'],
  ['🚐 minibus', '\u{1F690}'],
  ['✈️ airplane', '\u{2708}'],
  ['⚡ lightning', '\u{26A1}'],
  ['✅ check', '\u{2705}'],
];
for (const [name, char] of checks) {
  const idx = fixedText.indexOf(char);
  if (idx >= 0) {
    const end = Math.min(idx + 40, fixedText.indexOf('\n', idx) + 1 || idx + 40);
    console.log(`  ✓ ${name}: "${fixedText.substring(idx, end).replace(/\r?\n.*/s,'').substring(0,40)}"`);
  } else {
    console.log(`  ✗ ${name}: NOT FOUND`);
  }
}

// Show form-section-label headings
const labelRe = /form-section-label["'][^>]*>([^<]*)</g;
console.log('\n=== form-section-label headings ===');
let m;
while ((m = labelRe.exec(fixedText)) !== null) {
  const text = m[1];
  const hasCorrupt = /\uFFFD/.test(text);
  console.log((hasCorrupt ? '✗ ' : '✓ ') + JSON.stringify(text));
}

// Check DISPATCH TRACKER line
const dtIdx = fixedText.indexOf('DISPATCH TRACKER');
if (dtIdx >= 0) {
  const line = fixedText.substring(dtIdx, fixedText.indexOf('\n', dtIdx));
  console.log('\nDISPATCH TRACKER:', JSON.stringify(line));
}

console.log(`\nRemaining U+FFFD: ${remainingFffd} (${(fixedText.match(/\uFFFD/g)||[]).length} after post-processing)`);

// Write fixed file
writeFileSync(filePath, fixedText, 'utf8');
console.log(`\n✓ Written: ${filePath}`);
