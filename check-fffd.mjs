import { readFileSync } from 'fs';
const buf = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx.bak');

// Find each problematic area in the backup

// 1. Team Management area
const tmIdx = buf.indexOf(Buffer.from('Team Management'));
if (tmIdx >= 0) {
  const ctx = buf.slice(tmIdx, tmIdx+50);
  console.log('Team Management hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
  // C3A2 E280A0 27 = original E2 [86] 92 = → (right arrow, if 0x86 is wrong assumption)
  // Let me trace: C3A2 = 0xE2, E280A0 = ?
  // E2 80 A0 = U+2020 (†, dagger) -> W1252 0x86 -> byte 0x86
  // So original was: E2 86 27? No, 0x86 is the W1252 BYTE, not what 0x27 came from
  // The REVERSED sequence: E2, 86 (from †), 27 (ASCII apostrophe, not reversed)
  // = E2 86 27 -> INVALID (27 not continuation)
  // Original MUST have been E2 86 XX where XX was some byte that normalized to 0x27
  // 0x27 (apostrophe) normalized from: 0x91 (W1252 ' left single) or 0x92 (W1252 ' right single)
  // E2 86 91 = U+21D1 = ⇑ (UPWARDS DOUBLE ARROW)
  // E2 86 92 = U+21D2 = ⇒ (RIGHTWARDS DOUBLE ARROW) or...
  // Actually: E2 86 92 is NOT a double arrow. Let me check:
  console.log('\nE2 86 91 =', Buffer.from([0xE2, 0x86, 0x91]).toString('utf8'));
  console.log('E2 86 92 =', Buffer.from([0xE2, 0x86, 0x92]).toString('utf8'));
  console.log('E2 86 9C =', Buffer.from([0xE2, 0x86, 0x9C]).toString('utf8'));
}

// 2. Profit trend area
const profitIdx = buf.indexOf(Buffer.from('dailyReport.profit'));
if (profitIdx >= 0) {
  const ctx = buf.slice(profitIdx, profitIdx+80);
  console.log('\nProfit area hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
}

// 3. DETENTION_THRESHOLD area
const detIdx = buf.indexOf(Buffer.from('DETENTION_THRESHOLD'));
while (true) {
  if (detIdx < 0) break;
  const ctx = buf.slice(detIdx, detIdx+80);
  const text = ctx.toString('utf8');
  if (text.includes('\uFFFD') || text.includes('E2 80')) {
    console.log('\nDETENTION area:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
  }
  break;
}

// 4. {done ? area
const doneIdx = buf.indexOf(Buffer.from('{done ? '));
if (doneIdx >= 0) {
  const ctx = buf.slice(doneIdx, doneIdx+40);
  console.log('\n{done ? area:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
  console.log('Text:', ctx.toString('utf8'));
}

// 5. Stops - 1) button area
const stopsIdx = buf.indexOf(Buffer.from('additionalStops - 1'));
if (stopsIdx >= 0) {
  const ctx = buf.slice(stopsIdx, stopsIdx+50);
  console.log('\nStops area:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
}

// 6. shrink-0 area
const shrinkIdx = buf.indexOf(Buffer.from('shrink-0">'));
if (shrinkIdx >= 0) {
  const ctx = buf.slice(shrinkIdx, shrinkIdx+30);
  console.log('\nshrink-0 area:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
}
