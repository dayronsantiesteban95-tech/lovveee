import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const start = 3; // skip BOM
const bytes = rawBytes.slice(start);

// Look at where U+2500 (─) occurs - find E2 94 80 in raw bytes
let count = 0;
for (let i = 0; i < bytes.length - 2 && count < 5; i++) {
  if (bytes[i] === 0xE2 && bytes[i+1] === 0x94 && bytes[i+2] === 0x80) {
    const ctx = bytes.slice(Math.max(0,i-10), i+15);
    console.log(`─ (E2 94 80) at byte ${i}:`);
    console.log('  Hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('  Text:', JSON.stringify(ctx.toString('utf8')));
    count++;
  }
}

// Check if any 4-byte UTF-8 sequences exist (these would be emoji encoded properly)
let fourByteCount = 0;
for (let i = 0; i < bytes.length - 3; i++) {
  if ((bytes[i] & 0xF8) === 0xF0) {
    fourByteCount++;
  }
}
console.log(`\n4-byte UTF-8 sequences (emoji range): ${fourByteCount}`);

// U+2500 in UTF-8 is E2 94 80 - this IS a legitimate 3-byte sequence
// If the ORIGINAL file had ─ (U+2500), then in UTF-8 it would be E2 94 80
// After W1252 corruption:
// E2 -> C3 A2 (â)
// 94 -> W1252 0x94 = " (U+201D) -> E2 80 9D
// 80 -> W1252 0x80 = € (U+20AC) -> E2 82 AC
// So corrupted ─ would be: C3 A2 E2 80 9D E2 82 AC
// = â" € in UTF-8 = â, ", €

// But we're finding E2 94 80 directly! That means these are NOT corrupted - 
// they're clean UTF-8 box chars that survived OR the corruption for U+2500 
// resulted in bytes that happen to form another valid UTF-8 sequence.

// Let me check: 
// ─ = U+2500 = E2 94 80
// Corrupt path: E2->C3A2, 94->E2809D (since W1252 0x94=U+201D="), 80->E282AC
// C3A2 E2809D E282AC - this would be "â"€" which is U+00E2 U+201D U+20AC
// NOT U+2500

// So E2 94 80 in the file is LEGITIMATE, NOT corrupted.
// But wait - why would there be legitimate ─ chars if the file is fully corrupted?

// Answer: Because NOT all chars in the file are corrupted!
// The corruption only affects chars that came from double-encoding.
// If the original file used ─ directly and it was saved correctly as E2 94 80,
// then during the corruption step, E2 was treated as Latin-1 â (0xE2),
// 94 was treated as W1252 " (U+201D), and 80 was W1252 € (U+20AC).
// Those got re-encoded, so ─ should NOT appear as E2 94 80 anymore.

// UNLESS: the corruption only affected the INITIAL save (like in a Git commit via
// a bad tool), and some later saves went through correctly.
// OR: the file was partially fixed already.

// Let me check the context of ─
let dCount = 0;
for (let i = 0; i < bytes.length - 2 && dCount < 10; i++) {
  if (bytes[i] === 0xE2 && bytes[i+1] === 0x94 && bytes[i+2] === 0x80) {
    const ctx = bytes.slice(Math.max(0,i-30), i+30);
    console.log(`\n─ at byte ${i}: ${JSON.stringify(ctx.toString('utf8'))}`);
    dCount++;
  }
}
