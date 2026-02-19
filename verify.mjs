import { readFileSync } from 'fs';
const content = readFileSync('C:/Users/Ilove/.openclaw/workspace/lovveee/src/pages/DispatchTracker.tsx', 'utf8');

// Find AOG_SERVICE_TYPES block
const idx = content.indexOf('AOG_SERVICE_TYPES');
if (idx >= 0) {
  console.log('AOG_SERVICE_TYPES block:');
  console.log(JSON.stringify(content.substring(idx, idx+300)));
  console.log('---');
  console.log(content.substring(idx, idx+300));
}

// Check for en dash and bullet
console.log('\nEn dash (U+2013) present:', content.includes('\u2013'));
console.log('Bullet (U+2022) present:', content.includes('\u2022'));
console.log('Em dash (U+2014) present:', content.includes('\u2014'));

// Find where bullets might be
let bidx = content.indexOf('\u2022');
while (bidx !== -1) {
  console.log('Bullet at', bidx, ':', JSON.stringify(content.substring(bidx-10, bidx+20)));
  bidx = content.indexOf('\u2022', bidx+1);
}

// Check the DISPATCH TRACKER area for the header
const dtIdx = content.indexOf('DISPATCH TRACKER');
if (dtIdx >= 0) {
  console.log('\nFull header area:');
  console.log(content.substring(dtIdx-50, dtIdx+200));
}

// Check remaining non-ASCII that looks weird
const weirdRe = /[^\x00-\x7F\u2014\u2013\u2018\u2019\u201C\u201D\u2022\u2026\u2122\u00E9\u00E1\u00ED\u00F3\u00FA\u00FC\u00F1\u00C1\u00C9\u00CD\u00D3\u00DA\u00DC\u00D1\u00BF\u00A1\u2550\u2502\u2506\u254C\u2500\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2560\u2563\u2566\u2569\u256C\u2554\u2557\u255A\u255D\u255E\u255F\u2561\u2562\u2564\u2565\u2567\u2568\u256A\u256B\u2580\u2584\u2588\u258C\u2590\u2591\u2592\u2593\u2320\u2321\u2248\u2261\u2264\u2265\u00B0\u00B7\u00B1\u00D7\u00F7\u221A\u00B9\u00B2\u00B3\u2190\u2191\u2192\u2193\u21B5\u21E7\u2713\u2714\u2717\u2718\uFFFD]/g;

// Find non-ASCII chars not in common set
let weirdCount = 0;
const weirdMap = new Map();
let wm;
while ((wm = weirdRe.exec(content)) !== null && weirdCount < 30) {
  const cp = content.codePointAt(wm.index);
  const key = `U+${cp.toString(16).padStart(4,'0')} ${content[wm.index]}`;
  if (!weirdMap.has(key)) {
    weirdMap.set(key, { count: 1, example: JSON.stringify(content.substring(wm.index-5, wm.index+10)) });
  } else {
    weirdMap.get(key).count++;
  }
  weirdCount++;
}
console.log('\nSuspect non-ASCII chars:');
for (const [key, val] of weirdMap) {
  console.log(`  ${key} x${val.count}: ${val.example}`);
}
