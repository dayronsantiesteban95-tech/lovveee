import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const start = 3;
const bytes = rawBytes.slice(start);

// Find all C3 A2 E2 82 AC C2 sequences
console.log('=== C3A2 E282AC C2 contexts ===');
let count = 0;
for (let i = 0; i < bytes.length - 7; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC && bytes[i+5] === 0xC2) {
    const ctx = bytes.slice(Math.max(0,i-15), i+20);
    console.log(`At ${i}:`);
    console.log('  Hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('  UTF8:', ctx.toString('utf8'));
    count++;
    if (count > 5) break;
  }
}

// Find all C3 A2 E2 82 AC 22 sequences
console.log('\n=== C3A2 E282AC 22 contexts (em dash corrupted) ===');
count = 0;
for (let i = 0; i < bytes.length - 6; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC && bytes[i+5] === 0x22) {
    const ctx = bytes.slice(Math.max(0,i-20), i+30);
    console.log(`At ${i}:`);
    console.log('  Hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('  UTF8:', ctx.toString('utf8'));
    count++;
    if (count > 3) break;
  }
}

// Check for other similar patterns
// En dash — U+2013 = E2 80 93
// E2 → C3 A2, 80 → E2 82 AC, 93 → W1252 0x93 = " (U+201C) → E2 80 9C
// OR if 93 was normalized to ASCII 0x22: C3 A2 E2 82 AC 22
// Hmm same pattern as em dash! Let me check if we can distinguish.

// Actually:
// Em dash U+2014 = E2 80 94: last byte 94 in W1252 = " (right double quote)
// En dash U+2013 = E2 80 93: last byte 93 in W1252 = " (left double quote)
// Both smart quotes could be normalized to ASCII " (0x22)
// So C3A2 E282AC 22 could be EITHER en dash or em dash

// But in comments like "DISPATCH TRACKER — Daily" it should be em dash
// Let me check the broader context of these occurrences

console.log('\n=== ALL em/en dash corrupted patterns (C3A2 E282AC 22) ===');
count = 0;
for (let i = 0; i < bytes.length - 6; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC && bytes[i+5] === 0x22) {
    const ctx = bytes.slice(Math.max(0,i-30), i+30);
    const text = ctx.toString('utf8');
    console.log(`At ${i}: ${JSON.stringify(text)}`);
    count++;
  }
}
console.log('Total:', count);

// Also look for patterns with other final bytes
// Apostrophes: ' = U+2019 = E2 80 99, ' = U+2018 = E2 80 98
// C3A2 E282AC 27 would mean byte 0x92 or 0x91 (smart apostrophes) → ASCII '
console.log('\n=== Other â€ patterns ===');
const patterns = {};
for (let i = 0; i < bytes.length - 5; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC) {
    const next = bytes[i+5].toString(16).padStart(2,'0');
    patterns[next] = (patterns[next] || 0) + 1;
  }
}
for (const [h, c] of Object.entries(patterns).sort()) {
  const isCont = (parseInt(h, 16) & 0xC0) === 0x80;
  console.log(`  â€ (C3A2 E282AC) ${h}: ${c} times ${isCont ? '(proper continuation)' : '(NORMALIZED ASCII)'}`);
}

// Look for C3 A2 followed by other 3-byte sequences
// For example â€™ (right single quote ') = E2 80 99
// The normalized form would be C3A2 E282AC 27 (0x92 normalized to ')
console.log('\n=== Smart apostrophe check ===');
count = 0;
for (let i = 0; i < bytes.length - 5; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC && bytes[i+5] === 0x27) {
    const ctx = bytes.slice(Math.max(0,i-15), i+20).toString('utf8');
    console.log(`' at ${i}: ${JSON.stringify(ctx)}`);
    count++;
    if (count > 3) break;
  }
}

// Check which of these should be em-dash vs en-dash by looking at context
// "DISPATCH TRACKER — Daily" → em dash (separating title from description)
// "Tab 1: Load Board — CRUD" → em dash
// "After Hours (20:00—07:59)" → en dash (range)
