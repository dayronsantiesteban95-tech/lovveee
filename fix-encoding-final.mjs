/**
 * Final fix for UTF-8 double-encoding in DispatchTracker.tsx
 * 
 * The corruption: Original UTF-8 bytes → misread as Windows-1252 → re-encoded as UTF-8
 * 
 * The fix: Read corrupted UTF-8 → reverse W1252 mapping → get original bytes → decode as UTF-8
 * 
 * Edge case: Some emoji bytes went through a slightly different path where 0x93 (W1252 ")
 * was already normalized to ASCII 0x22 before re-encoding. We detect these as invalid
 * UTF-8 continuation bytes in the original stream and keep them as-is.
 */

import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'src', 'pages', 'DispatchTracker.tsx');
const backupPath = filePath + '.bak';

// Backup original
copyFileSync(filePath, backupPath);
console.log('Backed up to', backupPath);

// W1252 special range: Unicode → original byte (0x80-0x9F)
const unicodeToW1252 = new Map([
  [0x20AC, 0x80], // €
  [0x201A, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201E, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02C6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8A], // Š
  [0x2039, 0x8B], // ‹
  [0x0152, 0x8C], // Œ
  [0x017D, 0x8E], // Ž
  [0x2018, 0x91], // '
  [0x2019, 0x92], // '
  [0x201C, 0x93], // " (left double quote)
  [0x201D, 0x94], // " (right double quote)
  [0x2022, 0x95], // •
  [0x2013, 0x96], // – (en dash)
  [0x2014, 0x97], // — (em dash)
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
]);

// Read raw bytes
const rawBytes = readFileSync(filePath);
console.log(`File size: ${rawBytes.length} bytes`);

// Skip UTF-8 BOM (EF BB BF)
const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
const inputBytes = hasBOM ? rawBytes.slice(3) : rawBytes;
console.log(`Has BOM: ${hasBOM}, Input bytes: ${inputBytes.length}`);

// Process byte-by-byte: decode UTF-8 codepoints, then reverse-map
function reverseW1252Encoding(inputBuf) {
  const outputBytes = [];
  let i = 0;
  let stats = { ascii: 0, latin1: 0, w1252: 0, preserved: 0, invalid: 0 };
  
  while (i < inputBuf.length) {
    const b0 = inputBuf[i];
    
    // ASCII (0x00-0x7F) - pass through unchanged
    if (b0 < 0x80) {
      outputBytes.push(b0);
      stats.ascii++;
      i++;
      continue;
    }
    
    // 2-byte UTF-8 sequence (0xC0-0xDF + continuation)
    if ((b0 & 0xE0) === 0xC0 && i + 1 < inputBuf.length && (inputBuf[i+1] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x1F) << 6) | (inputBuf[i+1] & 0x3F);
      
      if (unicodeToW1252.has(cp)) {
        // W1252 special char → original byte
        outputBytes.push(unicodeToW1252.get(cp));
        stats.w1252++;
      } else if (cp >= 0xA0 && cp <= 0xFF) {
        // Latin-1 supplement → byte value equals codepoint
        outputBytes.push(cp);
        stats.latin1++;
      } else if (cp >= 0x80 && cp <= 0x9F) {
        // Control chars → byte value equals codepoint  
        outputBytes.push(cp);
        stats.latin1++;
      } else {
        // Higher Unicode that is NOT a W1252 artifact - preserve as UTF-8
        // This should not happen in double-encoded chars (all double-encoded chars
        // produce codepoints <= 0xFF or in W1252 special map)
        outputBytes.push(b0, inputBuf[i+1]);
        stats.preserved++;
      }
      i += 2;
      continue;
    }
    
    // 3-byte UTF-8 sequence (0xE0-0xEF + 2 continuations)
    if ((b0 & 0xF0) === 0xE0 && i + 2 < inputBuf.length && 
        (inputBuf[i+1] & 0xC0) === 0x80 && (inputBuf[i+2] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x0F) << 12) | ((inputBuf[i+1] & 0x3F) << 6) | (inputBuf[i+2] & 0x3F);
      
      if (unicodeToW1252.has(cp)) {
        outputBytes.push(unicodeToW1252.get(cp));
        stats.w1252++;
      } else if (cp >= 0xA0 && cp <= 0xFF) {
        outputBytes.push(cp);
        stats.latin1++;
      } else {
        // Legitimate 3-byte Unicode (like U+2500 ─) - preserve as UTF-8
        outputBytes.push(b0, inputBuf[i+1], inputBuf[i+2]);
        stats.preserved++;
      }
      i += 3;
      continue;
    }
    
    // 4-byte UTF-8 sequence (0xF0-0xF7 + 3 continuations)
    if ((b0 & 0xF8) === 0xF0 && i + 3 < inputBuf.length && 
        (inputBuf[i+1] & 0xC0) === 0x80 && (inputBuf[i+2] & 0xC0) === 0x80 && (inputBuf[i+3] & 0xC0) === 0x80) {
      // Full 4-byte sequence - this would only exist for genuinely high Unicode
      // In a double-encoded file, 4-byte sequences shouldn't occur
      // (because each original byte was encoded separately as 1 or 2 byte sequences)
      const cp = ((b0 & 0x07) << 18) | ((inputBuf[i+1] & 0x3F) << 12) | 
                 ((inputBuf[i+2] & 0x3F) << 6) | (inputBuf[i+3] & 0x3F);
      outputBytes.push(b0, inputBuf[i+1], inputBuf[i+2], inputBuf[i+3]);
      stats.preserved++;
      i += 4;
      continue;
    }
    
    // Invalid/continuation byte - keep as-is
    outputBytes.push(b0);
    stats.invalid++;
    i++;
  }
  
  return { outputBytes, stats };
}

const { outputBytes, stats } = reverseW1252Encoding(inputBytes);
console.log('\nProcessing stats:');
console.log('  ASCII pass-through:', stats.ascii);
console.log('  Latin-1 reversed:', stats.latin1);
console.log('  W1252 special reversed:', stats.w1252);
console.log('  Legitimate Unicode preserved:', stats.preserved);
console.log('  Invalid bytes kept:', stats.invalid);
console.log('  Output bytes:', outputBytes.length);

// Decode as UTF-8
const outputBuf = Buffer.from(outputBytes);
const fixedText = outputBuf.toString('utf8');
console.log('\nFixed text length:', fixedText.length, 'chars');
console.log('Output bytes:', Buffer.byteLength(fixedText, 'utf8'), '(re-encoded)');

// Validate key strings
console.log('\n=== VALIDATION ===');
const checks = [
  ['Box drawing chars', '═'],
  ['Em dash', '\u2014'],
  ['Bullet', '\u2022'],
  ['Ellipsis', '\u2026'],
  ['DISPATCH TRACKER', 'DISPATCH TRACKER'],
];

for (const [name, char] of checks) {
  const idx = fixedText.indexOf(char);
  console.log(`  ${name}: ${idx >= 0 ? 'FOUND at ' + idx : 'NOT FOUND'}`);
  if (idx >= 0) {
    console.log('    Context:', JSON.stringify(fixedText.substring(idx-10, idx+30)));
  }
}

// Show first 300 chars
console.log('\n=== FIRST 300 CHARS ===');
console.log(fixedText.substring(0, 300));

// Show around "Courier" label (was corrupted)
const courierIdx = fixedText.indexOf('Courier');
if (courierIdx >= 0) {
  console.log('\n=== COURIER LABEL CONTEXT ===');
  console.log(fixedText.substring(courierIdx - 50, courierIdx + 50));
}

// Check for remaining garbled chars (non-ASCII that shouldn't be there)
const garbledRe = /[ðŸÃâÂ]/g;
let garbled = [];
let gm;
while ((gm = garbledRe.exec(fixedText)) !== null && garbled.length < 5) {
  garbled.push({ pos: gm.index, ctx: fixedText.substring(gm.index-5, gm.index+10) });
}
if (garbled.length > 0) {
  console.log('\n=== POTENTIALLY REMAINING GARBLED (sample) ===');
  for (const g of garbled) {
    console.log(`  At ${g.pos}: ${JSON.stringify(g.ctx)}`);
  }
}

// Write the fixed file (UTF-8 without BOM)
writeFileSync(filePath, fixedText, 'utf8');
console.log(`\n✓ Wrote fixed file: ${filePath}`);
console.log(`  Size: ${Buffer.byteLength(fixedText, 'utf8')} bytes`);
