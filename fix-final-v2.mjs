import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'src', 'pages', 'DispatchTracker.tsx');

// W1252 special range reverse map: Unicode codepoint to original byte
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

// STEP 1: Pre-process - fix the normalized ASCII patterns
// C3 A2 E2 82 AC 22 -> E2 80 94 (em dash, where 0x94 was normalized to ASCII 0x22)
function preprocessBytes(buf) {
  const output = [];
  let i = 0;
  let fixCount = 0;
  while (i < buf.length) {
    if (i + 5 < buf.length &&
        buf[i] === 0xC3 && buf[i+1] === 0xA2 &&
        buf[i+2] === 0xE2 && buf[i+3] === 0x82 && buf[i+4] === 0xAC &&
        buf[i+5] === 0x22) {
      output.push(0xE2, 0x80, 0x94); // em dash
      i += 6;
      fixCount++;
      continue;
    }
    output.push(buf[i]);
    i++;
  }
  console.log(`Pre-processing: Fixed ${fixCount} em dash corruptions (C3A2 E282AC 22 -> E28094)`);
  return Buffer.from(output);
}

// STEP 2: W1252 reverse mapping
function reverseW1252(buf) {
  const output = [];
  let i = 0;
  const stats = { ascii: 0, latin1: 0, w1252: 0, preserved: 0 };
  while (i < buf.length) {
    const b0 = buf[i];
    if (b0 < 0x80) {
      output.push(b0); stats.ascii++; i++; continue;
    }
    if ((b0 & 0xE0) === 0xC0 && i + 1 < buf.length && (buf[i+1] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x1F) << 6) | (buf[i+1] & 0x3F);
      if (unicodeToW1252.has(cp)) { output.push(unicodeToW1252.get(cp)); stats.w1252++; }
      else if (cp >= 0x80 && cp <= 0xFF) { output.push(cp); stats.latin1++; }
      else { output.push(b0, buf[i+1]); stats.preserved++; }
      i += 2; continue;
    }
    if ((b0 & 0xF0) === 0xE0 && i + 2 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80) {
      const cp = ((b0 & 0x0F) << 12) | ((buf[i+1] & 0x3F) << 6) | (buf[i+2] & 0x3F);
      if (unicodeToW1252.has(cp)) { output.push(unicodeToW1252.get(cp)); stats.w1252++; }
      else if (cp >= 0xA0 && cp <= 0xFF) { output.push(cp); stats.latin1++; }
      else { output.push(b0, buf[i+1], buf[i+2]); stats.preserved++; }
      i += 3; continue;
    }
    if ((b0 & 0xF8) === 0xF0 && i + 3 < buf.length && (buf[i+1] & 0xC0) === 0x80 && (buf[i+2] & 0xC0) === 0x80 && (buf[i+3] & 0xC0) === 0x80) {
      output.push(b0, buf[i+1], buf[i+2], buf[i+3]); stats.preserved++; i += 4; continue;
    }
    output.push(b0); i++;
  }
  console.log(`W1252 reverse: ASCII=${stats.ascii}, Latin1=${stats.latin1}, W1252=${stats.w1252}, Preserved=${stats.preserved}`);
  return Buffer.from(output);
}

const preprocessed = preprocessBytes(inputBytes);
const originalBytes = reverseW1252(preprocessed);
const fixedText = originalBytes.toString('utf8');
console.log(`Output: ${fixedText.length} chars, ${Buffer.byteLength(fixedText)} bytes`);

// VALIDATION
const checks = [
  ['Box drawing ═', '═'],
  ['Em dash —', '\u2014'],
  ['Ellipsis …', '\u2026'],
  ['BOX HEADER', '// ═══'],
];
for (const [name, str] of checks) {
  const idx = fixedText.indexOf(str);
  console.log(`  ${idx >= 0 ? '✓' : '✗'} ${name}: ${idx >= 0 ? fixedText.substring(idx, idx+40).replace(/\r?\n.*/,'') : 'NOT FOUND'}`);
}

// Show DISPATCH TRACKER line
const dtIdx = fixedText.indexOf('DISPATCH TRACKER');
if (dtIdx >= 0) {
  console.log('\nDISPATCH TRACKER:', JSON.stringify(fixedText.substring(dtIdx-4, dtIdx+60)));
}

// Show service type labels
['AOG', 'Courier', 'Standard'].forEach(svc => {
  const idx = fixedText.indexOf(`"${svc}",      label:`);
  if (idx < 0) {
    const idx2 = fixedText.indexOf(`"${svc}",  label:`);
    if (idx2 >= 0) console.log(`${svc} label:`, JSON.stringify(fixedText.substring(idx2-5, idx2+50)));
  } else {
    console.log(`${svc} label:`, JSON.stringify(fixedText.substring(idx-5, idx+50)));
  }
});

// Show DRIVER ASSIGNMENT and BOL DOCUMENT labels
['DRIVER ASSIGNMENT', 'BOL DOCUMENT', 'BOL Upload'].forEach(lbl => {
  const idx = fixedText.indexOf(lbl);
  if (idx >= 0) console.log(`"${lbl}" context:`, JSON.stringify(fixedText.substring(idx-5, idx+50)));
});

// Write fixed file
writeFileSync(filePath, fixedText, 'utf8');
console.log(`\n✓ Written: ${filePath}`);
