import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
// Has BOM: EF BB BF
const start = 3; // skip BOM
const bytes = rawBytes.slice(start);

console.log('Original bytes count:', bytes.length);
console.log('First 30 bytes:', Array.from(bytes.slice(0, 30)).map(b => b.toString(16).padStart(2,'0')).join(' '));

// Manual decode: go byte-by-byte and try to decode UTF-8 sequences
// then reverse the W1252 double-encoding
//
// For each UTF-8 sequence in the file:
//   - Decode it to get Unicode codepoint
//   - Reverse-map through W1252 to get original byte
//   - Collect original bytes
//   - Finally decode as UTF-8

// W1252 special range: Unicode -> byte 0x80-0x9F
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
  [0x201C, 0x93], // "
  [0x201D, 0x94], // "
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
]);

// Decode bytes as UTF-8, getting codepoints
function decodeUtf8Bytes(buf) {
  const codepoints = [];
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    let cp, len;
    
    if (b < 0x80) {
      cp = b; len = 1;
    } else if ((b & 0xE0) === 0xC0) {
      if (i + 1 < buf.length && (buf[i+1] & 0xC0) === 0x80) {
        cp = ((b & 0x1F) << 6) | (buf[i+1] & 0x3F);
        len = 2;
      } else {
        cp = 0xFFFD; len = 1;
      }
    } else if ((b & 0xF0) === 0xE0) {
      if (i + 2 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80) {
        cp = ((b & 0x0F) << 12) | ((buf[i+1] & 0x3F) << 6) | (buf[i+2] & 0x3F);
        len = 3;
      } else {
        cp = 0xFFFD; len = 1;
      }
    } else if ((b & 0xF8) === 0xF0) {
      if (i + 3 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80 && (buf[i+3] & 0xC0) === 0x80) {
        cp = ((b & 0x07) << 18) | ((buf[i+1] & 0x3F) << 12) | ((buf[i+2] & 0x3F) << 6) | (buf[i+3] & 0x3F);
        len = 4;
      } else {
        cp = 0xFFFD; len = 1;
      }
    } else {
      cp = 0xFFFD; len = 1;
    }
    
    codepoints.push({ cp, len, offset: i });
    i += len;
  }
  return codepoints;
}

const codepoints = decodeUtf8Bytes(bytes);
console.log(`Total codepoints: ${codepoints.length}`);

// Count characters by type
let ascii = 0, latin1 = 0, w1252Special = 0, higherUnicode = 0, replacement = 0;
for (const { cp } of codepoints) {
  if (cp < 0x80) ascii++;
  else if (cp < 0xA0 && cp >= 0x80) { /* 0x80-0x9F control */ latin1++; }
  else if (cp >= 0xA0 && cp <= 0xFF) latin1++;
  else if (unicodeToW1252.has(cp)) w1252Special++;
  else if (cp === 0xFFFD) replacement++;
  else higherUnicode++;
}
console.log(`  ASCII: ${ascii}, Latin-1/Ctrl (0x80-0xFF): ${latin1}, W1252 special: ${w1252Special}, Higher Unicode (NOT corrupted): ${higherUnicode}, Replacement: ${replacement}`);

// The "higher Unicode" chars - these are chars > 0xFF that are NOT in the W1252 special map
// These should NOT be reversed - they're legitimate Unicode that wasn't corrupted
// Let's see what they are
const higherChars = new Map();
for (const { cp } of codepoints) {
  if (cp > 0xFF && !unicodeToW1252.has(cp) && cp !== 0xFFFD) {
    higherChars.set(cp, (higherChars.get(cp) || 0) + 1);
  }
}
console.log('\nHigher Unicode chars (not in W1252 map, could be legitimate):');
for (const [cp, count] of [...higherChars.entries()].sort((a,b) => b[1]-a[1]).slice(0,20)) {
  const ch = String.fromCodePoint(cp);
  console.log(`  U+${cp.toString(16).padStart(4,'0')} "${ch}" × ${count}`);
}

// The key question: are U+2022 (•, bullet) in the list?
// U+2022 IS in our W1252 map as byte 0x95
// But wait - if the file has legitimate bullets • that were NOT double-encoded,
// we'd wrongly convert them.
// Let's check WHERE bullets appear
console.log('\nU+2022 bullet occurrences:');
let bulletCount = 0;
for (const { cp, offset } of codepoints) {
  if (cp === 0x2022 && bulletCount < 5) {
    const ctxBytes = bytes.slice(Math.max(0, offset-20), offset+20);
    const ctx = ctxBytes.toString('utf8');
    console.log(`  offset ${offset}: ${JSON.stringify(ctx)}`);
    bulletCount++;
  }
}
console.log(`  Total bullets: ${codepoints.filter(x => x.cp === 0x2022).length}`);

// Key insight: All U+2022 in W1252 map are double-encoded artifacts
// Because in the original source, bullets would be written as U+2022 directly in UTF-8
// which would get corrupted. OR they could be legitimate bullets.
// 
// The REAL question: were there any legitimate special chars (em dash, bullets, etc.)
// in the ORIGINAL source that should be KEPT as-is?
// 
// Answer: Looking at the file, it's TypeScript/TSX code. Special chars would only appear in:
// 1. String literals (JSX text, labels, etc.)  
// 2. Comments
// In both cases, they were original UTF-8 that got corrupted.
// There's NO reason to have truly legitimate W1252-range Unicode in this file that wasn't corrupted.
// EXCEPT: box-drawing chars in comments are also UTF-8 that got corrupted.
// 
// So: ALL W1252-mappable chars in this file are corrupted. The fix is safe.

console.log('\n=== TESTING REVERSE DECODE ON FIRST 100 BYTES ===');
const testCPs = codepoints.slice(0, 50);
const testOriginalBytes = [];
for (const { cp } of testCPs) {
  if (cp <= 0x7F) {
    testOriginalBytes.push(cp);
  } else if (unicodeToW1252.has(cp)) {
    testOriginalBytes.push(unicodeToW1252.get(cp));
  } else if (cp >= 0xA0 && cp <= 0xFF) {
    testOriginalBytes.push(cp);
  } else if (cp >= 0x80 && cp <= 0x9F) {
    testOriginalBytes.push(cp); // control chars map to themselves
  } else if (cp === 0xFFFD) {
    // Skip replacement chars - they represent invalid bytes
    // We should NOT include them in output
  } else {
    // Higher Unicode - not double-encoded, encode as UTF-8
    const buf = Buffer.from(String.fromCodePoint(cp), 'utf8');
    for (const b of buf) testOriginalBytes.push(b);
  }
}

const decoded = Buffer.from(testOriginalBytes).toString('utf8');
console.log('Decoded first 50 chars:', JSON.stringify(decoded));
// Should start with: // ═══... (box drawing chars)
