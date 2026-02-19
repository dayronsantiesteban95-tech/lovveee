import { readFileSync } from 'fs';
const content = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx', 'utf8');

// Find form-section-label headings
const re = /form-section-label["'][^>]*>([^<]*)</g;
let m;
console.log('=== form-section-label headings ===');
while ((m = re.exec(content)) !== null) {
  const text = m[1];
  const hasCorrupt = /[\uFFFD\uFFFE\u0000-\u001F\u007F-\u009F]/.test(text) || 
                     text.includes('?') || 
                     /[^\x20-\x7E\u0100-\u{10FFFF}]/u.test(text);
  console.log((hasCorrupt ? '✗ CORRUPT: ' : '✓ OK: ') + JSON.stringify(text));
}

// Also find all FFFD in content with context
console.log('\n=== U+FFFD occurrences ===');
let idx = 0;
let count = 0;
while ((idx = content.indexOf('\uFFFD', idx)) !== -1 && count < 30) {
  const ctx = content.substring(Math.max(0,idx-15), idx+30);
  console.log(`At ${idx}: ${JSON.stringify(ctx)}`);
  idx++;
  count++;
}
console.log(`Total FFFD: ${(content.match(/\uFFFD/g)||[]).length}`);

// Check toast labels too
const toastRe = /toast\({[^}]*title:\s*["'`]([^"'`\n]*)/g;
console.log('\n=== Toast labels ===');
while ((m = toastRe.exec(content)) !== null) {
  const text = m[1];
  if (/[^\x20-\x7E]/.test(text)) {
    console.log(JSON.stringify(text));
  }
}
