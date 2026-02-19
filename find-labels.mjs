import { readFileSync } from 'fs';

const buf = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx');
const content = buf.toString('utf8');

console.log('=== ALL NON-ASCII UI STRINGS IN DISPATCHTTRACKER.TSX ===\n');

// Find label strings
const labelRe = /label:\s*["']([^"'\n]+?)["']/g;
let m;
let count = 0;
while ((m = labelRe.exec(content)) !== null) {
  const label = m[1];
  if (/[^\x00-\x7f]/.test(label)) {
    console.log(`label at ${m.index}: ${JSON.stringify(label)}`);
    count++;
  }
}
console.log(`Total corrupted labels: ${count}`);

console.log('\n=== JSX TEXT CONTENT WITH NON-ASCII ===\n');
// Find JSX string content: >"text"< patterns and string attributes
const jsxTextRe = />([^<>{}\n]*[^\x00-\x7f][^<>{}\n]*)</g;
count = 0;
while ((m = jsxTextRe.exec(content)) !== null) {
  const text = m[1];
  if (/[^\x00-\x7f]/.test(text) && count < 20) {
    console.log(`JSX text at ${m.index}: ${JSON.stringify(text)}`);
    count++;
  }
}

console.log('\n=== ALL STRINGS WITH NON-ASCII (sample) ===\n');
// Look for string literals with non-ASCII
const stringRe = /["'`]([^"'`\n]*[^\x00-\x7f][^"'`\n]*)["'`]/g;
count = 0;
while ((m = stringRe.exec(content)) !== null && count < 30) {
  const str = m[1];
  if (/[^\x00-\x7f]/.test(str)) {
    console.log(`string at ${m.index}: ${JSON.stringify(str)}`);
    count++;
  }
}

// Check specifically what the tab labels are
console.log('\n=== TAB/SECTION LABELS ===\n');
// Look for value="..." patterns with non-ascii
const valueRe = /value=["']([^"'\n]*[^\x00-\x7f][^"'\n]*)["']/g;
while ((m = valueRe.exec(content)) !== null) {
  console.log(`value at ${m.index}: ${JSON.stringify(m[1])}`);
}

// Look for title: "..." 
const titleRe = /title:\s*["']([^"'\n]*[^\x00-\x7f][^"'\n]*)["']/g;
while ((m = titleRe.exec(content)) !== null) {
  console.log(`title at ${m.index}: ${JSON.stringify(m[1])}`);
}
