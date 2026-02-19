import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const start = (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) ? 3 : 0;
const bytes = rawBytes.slice(start);

console.log('=== UNDERSTANDING THE CORRUPTION ===\n');

// The bytes we saw around position 12707 (raw file pos):
// ef bf bd = U+FFFD (replacement character) 
// So the file already HAS replacement characters in it!
// This means the file was ALREADY partially invalid UTF-8 before being "fixed"

// Let's count FFFD in the file
let fffdCount = 0;
for (let i = 0; i < bytes.length - 2; i++) {
  if (bytes[i] === 0xEF && bytes[i+1] === 0xBF && bytes[i+2] === 0xBD) {
    fffdCount++;
  }
}
console.log(`U+FFFD (replacement char) count: ${fffdCount}`);

// Let's count the C3A2 double-encoding pattern
let c3a2Count = 0;
for (let i = 0; i < bytes.length - 1; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2) {
    c3a2Count++;
  }
}
console.log(`C3 A2 (â - double-encoded) count: ${c3a2Count}`);

// Let's understand the structure better
// Find all positions of â• (which should be ═) - the comment box lines
// â• = C3 A2 E2 80 A2 C2 90
let boxCount = 0;
for (let i = 0; i < bytes.length - 6; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xA2 && bytes[i+2] === 0xE2 && bytes[i+3] === 0x80 && bytes[i+4] === 0xA2 && bytes[i+5] === 0xC2 && bytes[i+6] === 0x90) {
    boxCount++;
  }
}
console.log(`Box char ═ (corrupted as âŠ•â€¢Ã) count: ${boxCount}`);

// Let's check DRIVER ASSIGNMENT and BOL DOCUMENT
// They should be in the file somewhere. Let me search broadly.
const fileText = bytes.toString('utf8');
console.log('\n=== SEARCHING FOR KEY STRINGS ===');

// Search for ASSIGNMENT  
let idx = fileText.indexOf('ASSIGNMENT');
while (idx !== -1) {
  console.log(`ASSIGNMENT at ${idx}: ${JSON.stringify(fileText.substring(idx-30, idx+40))}`);
  idx = fileText.indexOf('ASSIGNMENT', idx+1);
}

// Look for any corrupted emoji label patterns
// The user says "ÐŸS–" appears. Let's find it.
// Ð = U+00D0, Ÿ = U+0178, S = U+0053 (ASCII), – = U+2013 (en dash)
// But in our corrupted file:
// Ð would be C3 90 in UTF-8 (from 0xD0 -> double-encoded)
// Wait... if original had ÐŸ = D0 9F (Cyrillic Э in UTF-8)
// That doesn't make sense. ÐŸ is Cyrillic for a character.
// 
// The USER reports seeing "ÐŸS–" in the BROWSER (rendered).
// The browser is showing the UTF-8 file as if it's something else.
// 
// Let me think: if the browser shows ÐŸ, it's reading bytes D0 9F as... 
// D0 9F in UTF-8 = U+040F (Cyrillic Ї)... no, D0 9F is one 2-byte UTF-8 seq = U+041F (П)
// ÐŸ would be: Ð = first char, Ÿ = second char
// If the browser is using Latin-1 to display a UTF-8 file:
// Ð would be U+00D0 -> in Latin-1 that's byte 0xD0
// Ÿ would be U+0178 -> in Latin-1 that's byte... wait U+0178 > 255 so it can't be Latin-1
// 
// Actually this suggests the BROWSER VIEWER was showing garbled text, not the JS file itself.
// The JS file contains garbled chars that RENDER correctly as the UI strings.
//
// SO: The corruption is in the JSX string literals.
// When the browser renders the component, it displays whatever characters are in the JSX strings.
// Those strings currently contain corrupted Unicode.

// Let me look at what the UI renders. Find label strings near CARGO, BOL, DRIVER
console.log('\n=== UI LABEL STRINGS ===');
const labelPattern = /label:\s*["'`]([^"'`]+)["'`]/g;
let match;
const corruptedLabels = [];
while ((match = labelPattern.exec(fileText)) !== null) {
  const label = match[1];
  // Check if it contains non-ASCII chars that might be corrupted
  if (/[^\x00-\x7F]/.test(label)) {
    corruptedLabels.push({ pos: match.index, label });
  }
}
console.log(`Found ${corruptedLabels.length} labels with non-ASCII:`);
corruptedLabels.forEach(({pos, label}) => {
  console.log(`  At ${pos}: ${JSON.stringify(label)}`);
});
