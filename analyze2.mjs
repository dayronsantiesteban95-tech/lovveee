import { readFileSync } from 'fs';

const rawBytes = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const start = (rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF) ? 3 : 0;
const bytes = rawBytes.slice(start);

// Find the emoji at position 12707 (from search-content.mjs output)
// bytes around: c3 b0 c5 b8 22 c2 a6
const pos = 12707 - start; // adjust for BOM
const sample = bytes.slice(pos - 20, pos + 30);
console.log('Bytes around position 12707:');
console.log(Array.from(sample).map(b => b.toString(16).padStart(2,'0')).join(' '));

// The content reads as UTF-8: label: "ðŸ"¦ Standard"
// where ð = C3 B0, Ÿ = C5 B8, 22 = ASCII ", ¦ = C2 A6
// The 22 (ASCII ") is very suspicious - it's inside the emoji bytes

// Wait, let me re-read: C3 B0 C5 B8 22 C2 A6
// When read as UTF-8: ð (U+00F0), Ÿ (U+0178), " (U+0022), ¦ (U+00A6)
// Reverse-W1252: ð->0xF0, Ÿ->0x9F, "->0x22, ¦->0xA6
// Bytes: F0 9F 22 A6 ... This is NOT a valid UTF-8 emoji!

// BUT WAIT: 0x22 in the original might be literal. The ORIGINAL source file
// might have had the service_type label as: "📦 Standard" where 📦 = U+1F4E6
// U+1F4E6 = F0 9F 93 A6 in UTF-8
// F0 -> 0xF0 -> C3 B0 ✓
// 9F -> W1252: Ÿ -> C5 B8 ✓
// 93 -> W1252 0x93 = " (U+201C) -> E2 80 9C ... but we see 22 not E2 80 9C
// A6 -> 0xA6 -> C2 A6 ✓

// Hmm, 0x93 in W1252 = " (U+201C) which encodes to E2 80 9C, not 22.
// Unless... the tool that caused the double-encoding ALSO replaced U+201C with straight "?
// That's a possibility if the tool ran some kind of "smart quote to ASCII" normalization.

// Let me check another emoji. Let's find what's at position 12707 byte position
// by looking at the raw text before decoding

// The content "label: \"ðŸ\"¦ Standard\"" with double-encoding
// If original was: label: "📦 Standard"
// 📦 = F0 9F 93 A6
// but 0x93 would become U+201C (") which then becomes E2 80 9C
// That's 3 bytes, not 1.
// Result would be: C3 B0 C5 B8 E2 80 9C C2 A6 = ðŸ"¦

// BUT we see C3 B0 C5 B8 22 C2 A6 = ðŸ"¦ (with straight quote)
// So 0x93 in the original emitted 22 not E2 80 9C

// This means when the corruption happened, someone ALREADY ran a smart-quote
// to straight-quote normalization, converting U+201C back to 0x22 first.
// OR the emoji in the original was different.

// Let me check: what emoji has bytes F0 9F [?] A6 where [?] -> 22 after W1252?
// If the third byte was just 0x22 (ASCII ") -> that would make F0 9F 22 A6
// which is NOT a valid emoji (surrogate/continuation byte must be 0x80-0xBF)

// So actually: the byte 0x22 was NOT the result of W1252 re-encoding.
// The byte 0x22 was ALREADY in the file before the encoding corruption.
// This means the original source had: "📦 Standard" but the emoji was stored differently.

// ALTERNATIVE: The original emoji could be outside the problematic range
// and the file is PARTIALLY corrupted - only some chars got double-encoded
// while others (like 0x22) passed through as-is.

// Let me check what's happening with the box drawing chars which we KNOW are corrupted
// ═ = U+2550 = E2 95 90
// E2 -> W1252: â (U+00E2) -> C3 A2
// 95 -> W1252 0x95 = • (U+2022) -> E2 80 A2
// 90 -> W1252 0x90 = 0x90 (not in W1252 special map, so stays U+0090) -> C2 90
// Result: C3 A2 E2 80 A2 C2 90 ✓ - MATCHES the file!

// So the W1252 map is correct. Let me verify for position 12707 more carefully.
// What if the emoji in the original was NOT F0 9F XX A6 but the file already had
// partial corruption from the first time?

// Let me find ALL occurrences of C3 B0 C5 B8 and show what follows
let count = 0;
for (let i = 0; i < bytes.length - 6 && count < 10; i++) {
  if (bytes[i] === 0xC3 && bytes[i+1] === 0xB0 && bytes[i+2] === 0xC5 && bytes[i+3] === 0xB8) {
    const ctx = Array.from(bytes.slice(i, i+10)).map(b => b.toString(16).padStart(2,'0')).join(' ');
    const textCtx = bytes.slice(Math.max(0,i-15), i+20).toString('utf8');
    console.log(`At ${i+start}: [${ctx}] | ${JSON.stringify(textCtx)}`);
    count++;
  }
}
