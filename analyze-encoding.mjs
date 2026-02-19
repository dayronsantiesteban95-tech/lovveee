/**
 * Analyze the exact encoding situation in DispatchTracker.tsx
 * to understand the corruption pattern before fixing.
 */
import { readFileSync } from 'fs';

const filePath = 'C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx';
const rawBytes = readFileSync(filePath);

// Skip BOM
const start = (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) ? 3 : 0;
const bytes = rawBytes.slice(start);
console.log(`Raw bytes (sans BOM): ${bytes.length}`);

// Show bytes around "DISPATCH TRACKER"
// Find it: bytes D I S P A T C H = 44 49 53 50 41 54 43 48
const DISPATCH = Buffer.from('DISPATCH');
for (let i = 0; i < bytes.length - DISPATCH.length; i++) {
  let match = true;
  for (let j = 0; j < DISPATCH.length; j++) {
    if (bytes[i+j] !== DISPATCH[j]) { match = false; break; }
  }
  if (match) {
    const ctx = bytes.slice(Math.max(0, i-3), i + 60);
    console.log('\nDISPATCH TRACKER raw bytes:');
    console.log(Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    // Expected "DISPATCH TRACKER " = 44 49 53 50 41 54 43 48 20 54 52 41 43 4B 45 52 20
    // Then what?
    const afterTracker = bytes.slice(i + 17, i + 30); // 17 = length of "DISPATCH TRACKER "
    console.log('After "DISPATCH TRACKER ":');
    console.log(Array.from(afterTracker).map(b => b.toString(16).padStart(2,'0')).join(' '));
    break;
  }
}

// Key analysis: What byte sequence represents the dash?
// From earlier: C3 A2 E2 82 AC 22
// C3 A2 = U+00E2 (â in Latin-1)
// E2 82 AC = U+20AC (€ - this is the W1252 encoding of 0x80)
// 22 = U+0022 (ASCII double quote)
// 
// Original must have been: E2 80 22 ... but wait that doesn't make sense for em dash
// E2 80 94 = U+2014 (em dash)
// E2 -> misread as W1252 byte 0xE2 -> re-encoded as C3 A2 ✓
// 80 -> W1252 0x80 = U+20AC (€) -> re-encoded as E2 82 AC ✓  
// 94 -> W1252 0x94 = U+201D (right double quote ") -> re-encoded as E2 80 9D
// But we see 22 (ASCII ") not E2 80 9D
// 
// This means the file already had "â€"" as a 3-char sequence where the last char
// was already ASCII 0x22 instead of the right curly quote U+201D.
// This could mean it was already ONCE corrupted and the 0x94 byte was treated as 
// ISO-8859-1 (U+0094 = control char) and then when re-"fixing" it became 0x22 somehow...
// OR the original string was literally using straight quotes in a comment.
// 
// Let me check another way - find an emoji to understand the pattern better
// 🎉 = U+1F389 = F0 9F 8E 89 in UTF-8
// F0 -> W1252 = ð (U+00F0) -> C3 B0
// 9F -> W1252 0x9F = Ÿ (U+0178) -> C5 B8
// 8E -> W1252 0x8E = Ž (U+017D) -> C5 BD
// 89 -> W1252 0x89 = ‰ (U+2030) -> E2 80 B0
// Result: C3 B0 C5 B8 C5 BD E2 80 B0

// Search for this pattern
const emojiPattern = Buffer.from([0xC3, 0xB0, 0xC5, 0xB8]);
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xB0 && bytes[i+2] === 0xC5 && bytes[i+3] === 0xB8) {
    const ctx = bytes.slice(Math.max(0, i-10), i + 20);
    console.log('\nFound emoji pattern (ðŸ...) at', i, ':');
    console.log(Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    break;
  }
}

// Search for 🚚 (truck emoji U+1F69A = F0 9F 9A 9A)
// F0 -> C3 B0 (ð)
// 9F -> C5 B8 (Ÿ)
// 9A -> W1252 0x9A = š (U+0161) -> C5 A1
// 9A -> C5 A1 again
console.log('\nLooking for truck emoji pattern C3B0 C5B8 C5A1 C5A1...');
for (let i = 0; i < bytes.length - 4; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xB0 && bytes[i+2] === 0xC5 && bytes[i+3] === 0xB8) {
    const next4 = Array.from(bytes.slice(i, i+8)).map(b => b.toString(16).padStart(2,'0')).join(' ');
    const ctx_text = bytes.slice(i-20, i+30).toString('utf8', 'replace');
    console.log(`At ${i}: ${next4} | context: ${JSON.stringify(ctx_text)}`);
    break;
  }
}

// Summary of W1252 reverse encoding needed:
console.log('\n=== W1252 REVERSE MAP VERIFICATION ===');
// 0x9F in W1252 = U+0178 (Ÿ)
// 0x8E in W1252 = U+017D (Ž)
console.log('0x9F in W1252:', String.fromCharCode(0x0178), '-> should become byte 0x9F');
console.log('0x8E in W1252:', String.fromCharCode(0x017D), '-> should become byte 0x8E');
