import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const start = 3; // skip BOM
const bytes = rawBytes.slice(start);

// The em dash U+2014 in UTF-8 = E2 80 94
// After W1252 double-encoding:
// E2 → C3 A2 (â)
// 80 → E2 82 AC (€ via W1252 0x80=€)
// 94 → W1252 0x94 = " (U+201D) → E2 80 9D
// Expected: C3 A2 E2 82 AC E2 80 9D

// BUT the file shows: C3 A2 E2 82 AC 22
// 22 = ASCII " — so 0x94 was converted to ASCII 0x22 instead of being W1252-encoded to E2 80 9D

// Let's verify by looking at the em dash area
const DISPATCH = Buffer.from('DISPATCH');
for (let i = 0; i < bytes.length - DISPATCH.length; i++) {
  let match = true;
  for (let j = 0; j < DISPATCH.length; j++) {
    if (bytes[i+j] !== DISPATCH[j]) { match = false; break; }
  }
  if (match) {
    // Show bytes around "DISPATCH TRACKER "
    const start_ = Math.max(0, i-3);
    const end_ = Math.min(bytes.length-1, i+80);
    const ctx = bytes.slice(start_, end_);
    console.log('Around DISPATCH TRACKER:');
    console.log('Hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('Text:', ctx.toString('utf8'));
    break;
  }
}

// So we need to detect: the sequence E2 80 followed by a NON-continuation byte
// In valid UTF-8, E2 80 XX requires XX to be 80-BF
// E2 82 AC = € (valid)  
// E2 80 9D = " (valid)
// E2 80 94 = — (valid)  ← the original em dash
// 
// But the file has: C3 A2 (=â, but was E2 original byte) + E2 82 AC (=€, was 80) + 22 (was 94 NORMALIZED to ASCII)
//
// When we reverse:
// C3 A2 → U+00E2 → byte 0xE2 ✓
// E2 82 AC → U+20AC → W1252 byte 0x80 ✓  
// 22 → ASCII " → byte 0x22
// Result bytes: E2 80 22
// E2 80 is NOT a complete UTF-8 sequence (E2 starts a 3-byte seq, needs 2 more continuation bytes)
// E2 80 22: E2=lead, 80=continuation (valid), 22=NOT continuation (should be 80-BF)
// So E2 80 is an INCOMPLETE sequence, and 22 is the next standalone ASCII char

// The CORRECT original was: E2 80 94 = U+2014 —
// But 94 was normalized to 22 in the corruption process

// Now I need to understand: for WHICH characters was the 3rd byte normalized?
// W1252 0x94 = " (U+201D)
// W1252 0x93 = " (U+201C)
// W1252 0x96 = – (U+2013)
// W1252 0x97 = — (U+2014)
// W1252 0x91 = ' (U+2018)
// W1252 0x92 = ' (U+2019)
//
// These are all the "smart quotes/dashes" that Windows apps might normalize.
// If a tool did "smart quote normalization" converting:
// " → " (0x93→0x22)
// " → " (0x94→0x22)  
// ' → ' (0x91→0x27?)
// ' → ' (0x92→0x27?)
// – → - (0x96→0x2D?)
// — → - (0x97→0x2D?)
// 
// Let me check for E2 80 patterns followed by non-continuation bytes

let patterns = {};
for (let i = 0; i < bytes.length - 2; i++) {
  if (bytes[i] === 0xE2 && bytes[i+1] === 0x80) {
    const next = bytes[i+2];
    const key = next.toString(16).padStart(2,'0');
    patterns[key] = (patterns[key] || 0) + 1;
  }
}
console.log('\nE2 80 XX patterns:');
for (const [hex, count] of Object.entries(patterns).sort()) {
  const isContinuation = (parseInt(hex, 16) & 0xC0) === 0x80;
  const note = isContinuation ? '(valid continuation)' : '(NOT a continuation byte!)';
  console.log(`  E2 80 ${hex}: ${count} times ${note}`);
}

// Also check E2 82 patterns  
patterns = {};
for (let i = 0; i < bytes.length - 2; i++) {
  if (bytes[i] === 0xE2 && bytes[i+1] === 0x82) {
    const next = bytes[i+2];
    const key = next.toString(16).padStart(2,'0');
    patterns[key] = (patterns[key] || 0) + 1;
  }
}
console.log('\nE2 82 XX patterns:');
for (const [hex, count] of Object.entries(patterns).sort()) {
  const isContinuation = (parseInt(hex, 16) & 0xC0) === 0x80;
  const note = isContinuation ? '(valid)' : '(BROKEN!)';
  console.log(`  E2 82 ${hex}: ${count} times ${note}`);
}

// Look for C3 A2 E2 82 AC (the start of double-encoded em-dash or en-dash)
let emDashPatterns = {};
for (let i = 0; i < bytes.length - 5; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x82 && bytes[i+4] === 0xAC) {
    const next = bytes[i+5];
    const key = next.toString(16).padStart(2,'0');
    emDashPatterns[key] = (emDashPatterns[key] || 0) + 1;
  }
}
console.log('\nC3 A2 E2 82 AC XX (â€ + next byte):');
for (const [hex, count] of Object.entries(emDashPatterns).sort()) {
  let meaning = '';
  // What original char would this be?
  // C3A2 = 0xE2, E2 82 AC = 0x80, then XX
  // Original bytes: E2 80 XX
  // If XX can be determined from the displayed char:
  const cp = parseInt(hex, 16);
  if (cp === 0x22) meaning = '-> ASCII " (was 0x94 = ") -> em dash E2 80 94 corrupted';
  else if (cp === 0x27) meaning = '-> ASCII \' (was 0x92 = \u2019) -> right single quote';
  else if (cp === 0x2D) meaning = '-> ASCII - (was 0x96 or 0x97) -> en/em dash';
  else meaning = `-> byte 0x${hex}`;
  console.log(`  C3A2 E282AC ${hex}: ${count} times ${meaning}`);
}
