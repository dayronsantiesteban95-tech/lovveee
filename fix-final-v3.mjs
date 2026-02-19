/**
 * Fix UTF-8 double-encoding in DispatchTracker.tsx - Version 3
 * 
 * Two-pass approach:
 * Pass 1: Raw byte substitutions for patterns where normalization occurred
 *         (em dash where 0x94 was normalized to ASCII 0x22)
 * Pass 2: W1252 reverse mapping for remaining double-encoded chars
 * 
 * Key insight: The pre-processed em dash bytes (E2 80 94) must NOT be
 * re-processed by the W1252 reversal. We handle this by processing
 * the patterns in-place and marking processed regions.
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

const rawBytes = readFileSync(filePath);
const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
const inputBytes = hasBOM ? rawBytes.slice(3) : rawBytes;
console.log(`Input: ${inputBytes.length} bytes (BOM: ${hasBOM})`);

// Combined single-pass approach:
// For each byte position in input, decide the output bytes
// The key: we process UTF-8 sequences from the input and reverse the W1252 encoding
// BUT for the special case C3A2 E282AC 22 we output E2 80 94 directly

function fixEncoding(buf) {
  const output = [];
  let i = 0;
  const stats = { ascii: 0, latin1: 0, w1252: 0, preserved: 0, emDash: 0 };
  
  while (i < buf.length) {
    // SPECIAL CASE 1: C3 A2 E2 82 AC 22
    // = double-encoded E2, double-encoded 80, ASCII 22 (was 0x94 -> normalized to ASCII ")
    // Original: E2 80 94 = em dash U+2014
    if (i + 5 < buf.length &&
        buf[i] === 0xC3 && buf[i+1] === 0xA2 &&
        buf[i+2] === 0xE2 && buf[i+3] === 0x82 && buf[i+4] === 0xAC &&
        buf[i+5] === 0x22) {
      // Output em dash UTF-8 bytes directly (not through W1252 reversal)
      output.push(0xE2, 0x80, 0x94);
      i += 6;
      stats.emDash++;
      continue;
    }
    
    // SPECIAL CASE 2: C3 A2 E2 82 AC C2 A6
    // = double-encoded E2, double-encoded 80, double-encoded A6
    // Original: E2 80 A6 = ellipsis U+2026
    if (i + 6 < buf.length &&
        buf[i] === 0xC3 && buf[i+1] === 0xA2 &&
        buf[i+2] === 0xE2 && buf[i+3] === 0x82 && buf[i+4] === 0xAC &&
        buf[i+5] === 0xC2 && buf[i+6] === 0xA6) {
      // Output ellipsis UTF-8 bytes directly
      output.push(0xE2, 0x80, 0xA6);
      i += 7;
      stats.emDash++;
      continue;
    }
    
    const b0 = buf[i];
    
    // ASCII - pass through
    if (b0 < 0x80) {
      output.push(b0); stats.ascii++; i++; continue;
    }
    
    // 2-byte UTF-8 (C0-DF + continuation)
    if ((b0 & 0xE0) === 0xC0 && i + 1 < buf.length && (buf[i+1] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x1F) << 6) | (buf[i+1] & 0x3F);
      if (unicodeToW1252.has(cp)) { output.push(unicodeToW1252.get(cp)); stats.w1252++; }
      else if (cp >= 0x80 && cp <= 0xFF) { output.push(cp); stats.latin1++; }
      else { output.push(b0, buf[i+1]); stats.preserved++; }
      i += 2; continue;
    }
    
    // 3-byte UTF-8 (E0-EF + 2 continuations)
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
    
    // Invalid/lone byte
    output.push(b0); i++;
  }
  
  console.log(`Processing stats:`);
  console.log(`  ASCII: ${stats.ascii}, Latin1: ${stats.latin1}, W1252: ${stats.w1252}`);
  console.log(`  Preserved unicode: ${stats.preserved}, Special fixes (em dash/ellipsis): ${stats.emDash}`);
  return Buffer.from(output);
}

const outputBuf = fixEncoding(inputBytes);

// The output bytes are now the "original" UTF-8 file bytes
// But they include W1252 single-byte values (0x80-0xFF range) that aren't valid UTF-8
// We need to decode them as W1252 (or UTF-8) to get the final string

// Actually: the output bytes ARE the original UTF-8 bytes because:
// - ASCII chars were kept as ASCII (< 0x80)
// - W1252-mapped chars were converted BACK to their original byte values
// - Those original bytes ARE the UTF-8 bytes of the original file
// So: E2 80 94 is the UTF-8 for em dash, etc.

// BUT we have a problem: the W1252 reverse gives us bytes 0x80-0xFF
// where the original might have been a multi-byte UTF-8 sequence.
// For example: original '═' (U+2550) = E2 95 90 in UTF-8
// After corruption: E2->C3A2, 95->E280A2 (•), 90->C290
// After W1252 reverse: C3A2->0xE2, E280A2->0x95 (via W1252 map 0x2022->0x95), C290->0x90
// Output bytes: E2 95 90 -> which decodes as U+2550 (═) - CORRECT!

// So the output bytes ARE valid UTF-8 (in most cases) and we just need to toString them
const fixedText = outputBuf.toString('utf8');
console.log(`\nFixed text: ${fixedText.length} chars, ${Buffer.byteLength(fixedText)} bytes`);

// VALIDATION
console.log('\n=== VALIDATION ===');
const checks = [
  ['Box drawing ═', '═', 3],
  ['Em dash —', '\u2014', 5],
  ['Ellipsis …', '\u2026', 3],
  ['En dash –', '\u2013', 3],
  ['Bullet •', '\u2022', 3],
  ['BOX HEADER', '// ═══', 10],
  ['DISPATCH TRACKER', 'DISPATCH TRACKER', 30],
];
for (const [name, str, ctxLen] of checks) {
  const idx = fixedText.indexOf(str);
  if (idx >= 0) {
    const ctx = fixedText.substring(Math.max(0,idx-2), idx + Math.min(ctxLen, 30));
    console.log(`  ✓ ${name}: "${ctx.replace(/\r?\n.*/s, '').substring(0,40)}"`);
  } else {
    console.log(`  ✗ ${name}: NOT FOUND`);
  }
}

// Show full DISPATCH TRACKER line
const dtIdx = fixedText.indexOf('DISPATCH TRACKER');
if (dtIdx >= 0) {
  const line = fixedText.substring(dtIdx, fixedText.indexOf('\n', dtIdx));
  console.log(`\nDISPATCH TRACKER line: "${line}"`);
}

// Show AOG_SERVICE_TYPES labels  
const svcIdx = fixedText.indexOf('AOG_SERVICE_TYPES');
if (svcIdx >= 0) {
  console.log('\nService types block:');
  console.log(fixedText.substring(svcIdx, svcIdx + 200));
}

// Show DRIVER ASSIGNMENT
const daIdx = fixedText.indexOf('DRIVER ASSIGNMENT');
if (daIdx >= 0) {
  console.log('\nDRIVER ASSIGNMENT:', JSON.stringify(fixedText.substring(daIdx-5, daIdx+50)));
}

// Show BOL DOCUMENT  
const bolIdx = fixedText.indexOf('BOL DOCUMENT');
if (bolIdx >= 0) {
  console.log('BOL DOCUMENT:', JSON.stringify(fixedText.substring(bolIdx-5, bolIdx+50)));
}

// Write fixed file
writeFileSync(filePath, fixedText, 'utf8');
console.log(`\n✓ Written: ${filePath}`);
