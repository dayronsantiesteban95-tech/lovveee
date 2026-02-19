import { readFileSync } from 'fs';
const buf = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx.bak');

// Find all "shrink-0">" occurrences
const pattern = Buffer.from('shrink-0">');
let pos = 0;
while ((pos = buf.indexOf(pattern, pos)) !== -1) {
  const ctx = buf.slice(pos, pos+40);
  console.log(`At ${pos}: ${Array.from(ctx).map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
  console.log(`  ASCII: ${Array.from(ctx).map(b=>(b>=0x20&&b<=0x7E)?String.fromCharCode(b):'.').join('')}`);
  pos++;
}

// Also check DETENTION_THRESHOLD area
const detPat = Buffer.from('DETENTION_THRESHOLD');
pos = buf.indexOf(detPat);
if (pos >= 0) {
  const ctx = buf.slice(pos, pos+100);
  console.log('\nDETENTION_THRESHOLD area:');
  console.log(Array.from(ctx).map(b=>b.toString(16).padStart(2,'0')).join(' '));
}

// Check C3A2 CB86 27 pattern
let count = 0;
for (let i = 0; i < buf.length - 5; i++) {
  if (buf[i]===0xC3 && buf[i+1]===0xA2 && buf[i+2]===0xCB && buf[i+3]===0x86 && buf[i+4]===0x27) {
    const ctx = buf.slice(Math.max(0,i-10), i+15);
    console.log(`\nC3A2 CB86 27 at ${i}: ${Array.from(ctx).map(b=>b.toString(16).padStart(2,'0')).join(' ')}`);
    console.log(`  ASCII: ${Array.from(ctx).map(b=>(b>=0x20&&b<=0x7E)?String.fromCharCode(b):'.').join('')}`);
    count++;
  }
}
console.log(`Total C3A2 CB86 27 (minus sign): ${count}`);
