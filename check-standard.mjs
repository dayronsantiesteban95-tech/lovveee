import { readFileSync } from 'fs';
const buf = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');

// Find "Standard" in context of label:
const search = Buffer.from('Standard');
let found = 0;
for (let i = 0; i < buf.length - search.length && found < 3; i++) {
  let match = true;
  for (let j = 0; j < search.length; j++) {
    if (buf[i+j] !== search[j]) { match = false; break; }
  }
  if (match) {
    found++;
    const ctx = buf.slice(Math.max(0,i-25), i+20);
    console.log(`Standard at ${i}:`, Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('As UTF8:', ctx.toString('utf8'));
    console.log();
  }
}

// Also look at what's at the truck emoji position
// In the original, truck 🚚 = F0 9F 9A 9A
// In the BACKUP (C3A2 etc), truck was corrupted
// After fix, what's there?
const courierIdx = buf.indexOf(Buffer.from('Courier'));
if (courierIdx >= 0) {
  const ctx = buf.slice(Math.max(0,courierIdx-30), courierIdx+20);
  console.log('Courier area:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
  console.log('As UTF8:', ctx.toString('utf8'));
}

// Check for bullet points: U+2022 = E2 80 A2
// Search for E2 80 A2 in buffer
let bulletCount = 0;
for (let i = 0; i < buf.length - 2; i++) {
  if (buf[i] === 0xE2 && buf[i+1] === 0x80 && buf[i+2] === 0xA2) {
    bulletCount++;
    if (bulletCount <= 2) {
      const ctx = buf.slice(Math.max(0,i-10), i+15);
      console.log(`\nBullet • at ${i}:`, Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
      console.log('As UTF8:', ctx.toString('utf8'));
    }
  }
}
console.log('Total bullets:', bulletCount);

// Check for en dash: U+2013 = E2 80 93
let enDashCount = 0;
for (let i = 0; i < buf.length - 2; i++) {
  if (buf[i] === 0xE2 && buf[i+1] === 0x80 && buf[i+2] === 0x93) {
    enDashCount++;
    if (enDashCount <= 2) {
      const ctx = buf.slice(Math.max(0,i-10), i+15);
      console.log(`\nEn dash – at ${i}:`, Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
      console.log('As UTF8:', ctx.toString('utf8'));
    }
  }
}
console.log('Total en dashes:', enDashCount);

// Now check what's at the "Standard" label position - what bytes come before "Standard"
// Look for: label: "XXXX Standard" where XXXX is some emoji bytes
const labelStd = Buffer.from('label: "');
for (let i = 0; i < buf.length - 20 && found < 10; i++) {
  let match = true;
  for (let j = 0; j < labelStd.length; j++) {
    if (buf[i+j] !== labelStd[j]) { match = false; break; }
  }
  if (match) {
    // Check if "Standard" follows within 10 bytes
    const after = buf.slice(i+8, i+50);
    if (after.includes(Buffer.from('Standard'))) {
      console.log(`\nLabel block at ${i}:`, Array.from(buf.slice(i, i+40)).map(b => b.toString(16).padStart(2,'0')).join(' '));
      console.log('As UTF8:', buf.slice(i, i+40).toString('utf8'));
      found++;
    }
  }
}
