import { readFileSync } from 'fs';
const content = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx', 'utf8');

console.log('File length:', content.length);
console.log('');

// Search for BOL
let idx = 0;
let count = 0;
while ((idx = content.indexOf('BOL', idx)) !== -1 && count < 5) {
  console.log(`BOL at ${idx}: ${JSON.stringify(content.substring(idx-20, idx+40))}`);
  idx++;
  count++;
}

// Search for DRIVER ASSIGN
idx = 0;
count = 0;
while ((idx = content.indexOf('DRIVER', idx)) !== -1 && count < 3) {
  console.log(`DRIVER at ${idx}: ${JSON.stringify(content.substring(idx-5, idx+50))}`);
  idx++;
  count++;
}

// Show DISPATCH TRACKER context 
idx = content.indexOf('DISPATCH TRACKER');
if (idx >= 0) {
  console.log('\nDISPATCH TRACKER context:');
  console.log(JSON.stringify(content.substring(idx-2, idx+50)));
}

// Look for the emoji that should prefix "DRIVER ASSIGNMENT" - 📋 (U+1F4CB)
// In the corrupted file it shows as ÐŸS– ... let's check what bytes that is
// ÐŸ = D0 9F in UTF-8 (Cyrillic)
// S = 53 (ASCII)
// – = E2 80 93 (en dash in UTF-8)
// So the corrupted display "ÐŸS–" = bytes D0 9F 53 E2 80 93

// But what's the original? 📋 = U+1F4CB = F0 9F 93 8B in UTF-8
// F0 misread as W1252 -> U+00F0 = ð 
// 9F misread as W1252 -> U+0178 = Ÿ (since 9F in W1252 = Ÿ)
// 93 misread as W1252 -> U+201C = " (left double quote)
// 8B misread as W1252 -> U+2039 = ‹ (single left angle quote)
// Then re-encoded as UTF-8:
// ð (U+00F0) -> C3 B0
// Ÿ (U+0178) -> C5 B8
// " (U+201C) -> E2 80 9C  
// ‹ (U+2039) -> E2 80 B9
// Result: C3 B0 C5 B8 E2 80 9C E2 80 B9

// Let me search for this pattern in the content
const clipboardEmoji = content.indexOf('\u00F0\u0178\u201C\u2039');
console.log('\nClipboard emoji corrupted form (ðŸ"‹) at:', clipboardEmoji);
if (clipboardEmoji >= 0) {
  console.log('Context:', JSON.stringify(content.substring(clipboardEmoji-5, clipboardEmoji+30)));
}

// Also search for ð
let dIdx = 0;
let dCount = 0;
while ((dIdx = content.indexOf('\u00F0', dIdx)) !== -1 && dCount < 5) {
  console.log(`ð at ${dIdx}: ${JSON.stringify(content.substring(dIdx-3, dIdx+15))}`);
  dIdx++;
  dCount++;
}
