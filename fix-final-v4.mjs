/**
 * Final fix for UTF-8 double-encoding in DispatchTracker.tsx - Version 4
 * 
 * Handles:
 * 1. Standard W1252 double-encoding (C3A2 etc.) 
 * 2. Smart-quote normalization: W1252 0x93 (") and 0x94 (") were normalized to ASCII 0x22
 *    before re-encoding, causing broken byte sequences.
 * 3. Specific emoji patterns where 3rd byte (0x93/0x94) was normalized.
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

// Helper: match bytes at position
function matchAt(buf, i, ...expected) {
  if (i + expected.length > buf.length) return false;
  for (let j = 0; j < expected.length; j++) {
    if (buf[i+j] !== expected[j]) return false;
  }
  return true;
}

const rawBytes = readFileSync(filePath);
const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
const inputBytes = hasBOM ? rawBytes.slice(3) : rawBytes;
console.log(`Input: ${inputBytes.length} bytes (BOM: ${hasBOM})`);

// Shorthand for common sequences
const [C3B0, C5B8, C2, E2, AC, B9, E28094] = [0xC3, 0xC5, 0xC2, 0xE2, 0xAC, 0xB9, null];

function fixEncoding(buf) {
  const output = [];
  let i = 0;
  const stats = { ascii: 0, latin1: 0, w1252: 0, preserved: 0, emoji: 0, emDash: 0 };
  
  while (i < buf.length) {
    // ================================================================
    // SPECIAL CASES: normalized ASCII patterns (0x93/0x94 → 0x22)
    // ================================================================
    
    // PATTERN 1: C3A2 E282AC 22 → em dash (U+2014 = E2 80 94)
    // Original: E2 80 94, where 94 was normalized from W1252 0x94 → ASCII 0x22
    if (matchAt(buf, i, 0xC3, 0xA2, 0xE2, 0x82, 0xAC, 0x22)) {
      output.push(0xE2, 0x80, 0x94); // em dash
      i += 6; stats.emDash++; continue;
    }
    
    // PATTERN 2: C3B0 C5B8 22 C2A6 → 📦 (U+1F4E6 = F0 9F 93 A6)  "Standard", "Cargo Details"
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0xA6)) {
      output.push(0xF0, 0x9F, 0x93, 0xA6);
      i += 7; stats.emoji++; continue;
    }
    
    // PATTERN 3: C3B0 C5B8 22 C28D 22 → 📍 (U+1F4CD = F0 9F 93 8D)  "At Pickup", "At Delivery", etc.
    // Note: followed by 22 (closing quote) - that's the end of the label string
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0x8D)) {
      output.push(0xF0, 0x9F, 0x93, 0x8D);
      i += 7; stats.emoji++; continue;
    }
    
    // PATTERN 4: C3B0 C5B8 22 E280B9 → 📋 (U+1F4CB = F0 9F 93 8B)  "DAILY OPS", "Load Reference", etc.
    // E2 80 B9 = U+2039 (‹) which is W1252 0x8B → byte 0x8B (the 4th byte of the emoji)
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xE2, 0x80, 0xB9)) {
      output.push(0xF0, 0x9F, 0x93, 0x8B);
      i += 8; stats.emoji++; continue;
    }
    
    // PATTERN 5: C3B0 C5B8 22 22 → 📔 (U+1F4D4 = F0 9F 93 94)  "BOL Document", "Invoice generated"
    // Both 3rd AND 4th bytes (0x93, 0x94) were normalized to ASCII 0x22
    // The next char after would be a space (0x20) - verify to avoid false positive on closing quote
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0x22)) {
      // Check if next after 22 22 is space (0x20) - then it's an emoji prefix
      const nextByte = i + 6 < buf.length ? buf[i+6] : -1;
      if (nextByte === 0x20) { // emoji followed by space then text
        output.push(0xF0, 0x9F, 0x93, 0x94);
        i += 5; // consume C3B0 C5B8 22 and the first 22 (which was the 4th byte normalized)
        // Keep the second 22 as ASCII (it's the closing quote or space)
        // Actually: we need to consume C3B0 C5B8 22(3rd byte) 22(4th byte)
        // Then the next char is space
        // So consume 6 bytes: C3 B0 C5 B8 22 22
        // But we already did i += 5, so output the emoji and consume 6 bytes
        output.length -= 4; // remove the 4 bytes we just pushed
        output.push(0xF0, 0x9F, 0x93, 0x94);
        i = (i - 5) + 6; // reset to start + 6
        stats.emoji++; continue;
      }
    }
    
    // PATTERN 6: C3B0 C5B8 22 C2A1 → 📡 (U+1F4E1 = F0 9F 93 A1)  "Blast sent"
    if (matchAt(buf, i, 0xC3, 0xB0, 0xC5, 0xB8, 0x22, 0xC2, 0xA1)) {
      output.push(0xF0, 0x9F, 0x93, 0xA1);
      i += 7; stats.emoji++; continue;
    }
    
    // ================================================================
    // STANDARD W1252 REVERSE MAPPING
    // ================================================================
    
    const b0 = buf[i];
    
    if (b0 < 0x80) {
      output.push(b0); stats.ascii++; i++; continue;
    }
    
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
    
    output.push(b0); i++;
  }
  
  console.log(`Stats: ASCII=${stats.ascii}, Latin1=${stats.latin1}, W1252=${stats.w1252}, Preserved=${stats.preserved}, Emoji=${stats.emoji}, EmDash=${stats.emDash}`);
  return Buffer.from(output);
}

const outputBuf = fixEncoding(inputBytes);
const fixedText = outputBuf.toString('utf8');
console.log(`Output: ${fixedText.length} chars, ${Buffer.byteLength(fixedText)} bytes`);

// VALIDATION
console.log('\n=== VALIDATION ===');
const checks = [
  ['═ box drawing', '═'],
  ['— em dash', '\u2014'],
  ['… ellipsis', '\u2026'],
  ['📦 package emoji', '\u{1F4E6}'],
  ['📍 pin emoji', '\u{1F4CD}'],
  ['📋 clipboard emoji', '\u{1F4CB}'],
  ['📔 notebook emoji', '\u{1F4D4}'],
  ['📡 satellite emoji', '\u{1F4E1}'],
  ['👤 person emoji', '\u{1F464}'],
  ['✈️ airplane emoji', '\u{2708}'],
  ['⚡ lightning emoji', '\u{26A1}'],
  ['✅ check emoji', '\u{2705}'],
];
for (const [name, char] of checks) {
  const idx = fixedText.indexOf(char);
  if (idx >= 0) {
    const ctx = fixedText.substring(idx, Math.min(idx+30, fixedText.indexOf('\n', idx) || idx+30));
    console.log(`  ✓ ${name}: "${ctx.substring(0,40)}"`);
  } else {
    console.log(`  ✗ ${name}: NOT FOUND`);
  }
}

// Show service types block
const svcIdx = fixedText.indexOf('AOG_SERVICE_TYPES');
if (svcIdx >= 0) {
  console.log('\n=== SERVICE TYPES ===');
  console.log(fixedText.substring(svcIdx, svcIdx + 200));
}

// Show BOL Document label
const bolIdx = fixedText.indexOf('BOL Document');
if (bolIdx >= 0) {
  console.log('\n=== BOL DOCUMENT ===');
  console.log(fixedText.substring(bolIdx - 30, bolIdx + 60));
}

// Show Driver Assignment label
const daIdx = fixedText.indexOf('Driver Assignment');
if (daIdx >= 0) {
  console.log('\n=== DRIVER ASSIGNMENT ===');
  // Find the actual label in JSX
  const labelPIdx = fixedText.indexOf('form-section-label', daIdx - 200);
  if (labelPIdx >= 0 && labelPIdx > daIdx - 300) {
    console.log(fixedText.substring(labelPIdx - 5, labelPIdx + 80));
  }
}

// Check for remaining replacement chars  
const fffdCount = (fixedText.match(/\uFFFD/g) || []).length;
console.log(`\nRemaining U+FFFD (replacement chars): ${fffdCount}`);

// Write fixed file
writeFileSync(filePath, fixedText, 'utf8');
console.log(`\n✓ Written: ${filePath}`);
