import { readFileSync } from 'fs';
const content = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx', 'utf8');

// Find shrink-0 with FFFD
let idx = content.indexOf('shrink-0">');
while (idx >= 0) {
  const ctx = content.substring(idx, idx+60);
  if (ctx.includes('\uFFFD')) {
    console.log('At', idx, ':', JSON.stringify(content.substring(idx-50, idx+80)));
  }
  idx = content.indexOf('shrink-0">', idx+1);
}

// Show context at 164201 and 164526
[164201, 164526].forEach(pos => {
  if (pos < content.length) {
    console.log('\nAt', pos, ':', JSON.stringify(content.substring(pos-50, pos+80)));
  }
});

// Check DETENTION_THRESHOLD context in fixed file
const detIdx = content.indexOf('DETENTION_THRESHOLD');
if (detIdx >= 0) {
  console.log('\nDETENTION THRESHOLD area:', JSON.stringify(content.substring(detIdx, detIdx+100)));
}
