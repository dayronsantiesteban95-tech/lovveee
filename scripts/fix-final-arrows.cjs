const fs = require('fs');
const path = require('path');
function read(rel) { return fs.readFileSync(path.join(__dirname,'..', rel),'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(__dirname,'..', rel), c,'utf8'); }

// ─── DispatchBlast.tsx L275 -- JSX text with -> between expressions ───────────
let db = read('src/components/DispatchBlast.tsx');
db = db.replace(
  '{currentLoad.pickup_address ?? "--"} -> {currentLoad.delivery_address ?? "--"}',
  '{currentLoad.pickup_address ?? "--"} &rarr; {currentLoad.delivery_address ?? "--"}'
);
write('src/components/DispatchBlast.tsx', db);
console.log('[OK] DispatchBlast.tsx L275');

// ─── LoadSearchFilters.tsx L82 -- label string with -> ────────────────────────
let lsf = read('src/components/LoadSearchFilters.tsx');
lsf = lsf.replace(
  '{ value: "revenue_desc", label: "Revenue (High->Low)" }',
  '{ value: "revenue_desc", label: "Revenue (High to Low)" }'
);
write('src/components/LoadSearchFilters.tsx', lsf);
console.log('[OK] LoadSearchFilters.tsx L82');

// ─── ActivityLog.tsx L108-109 -- template literals (safe, but clean up) ───────
let al = read('src/components/ActivityLog.tsx');
// These are inside template literals, NOT JSX text -- safe as-is
// But replace for consistency
al = al.replace(
  '} -> ${evt.new_status}: "${evt.note}"`',
  '} to ${evt.new_status}: "${evt.note}"`'
);
al = al.replace(
  '} -> ${evt.new_status}`,',
  '} to ${evt.new_status}`,'
);
write('src/components/ActivityLog.tsx', al);
console.log('[OK] ActivityLog.tsx L108-109 (template literals)');

// ─── LeadFinder.tsx L163 -- template literal (safe, clean up) ─────────────────
let lf = read('src/pages/LeadFinder.tsx');
lf = lf.replace(
  '} -> Hub: ${hub.charAt(0).toUpperCase()',
  '} | Hub: ${hub.charAt(0).toUpperCase()'
);
write('src/pages/LeadFinder.tsx', lf);
console.log('[OK] LeadFinder.tsx L163 (template literal)');

// ─── DispatchTracker.tsx L431 -- string prop (safe, clean up) ─────────────────
let dt = read('src/pages/DispatchTracker.tsx');
dt = dt.replace(
  '"Integration settings will be in Team Management -> In',
  '"Integration settings will be in Team Management > In'
);
write('src/pages/DispatchTracker.tsx', dt);
console.log('[OK] DispatchTracker.tsx L431 (string prop)');

// TeamManagement.tsx L93, L100 -- JSDoc comments (safe, leave as-is)
console.log('[SKIP] TeamManagement.tsx L93,L100 -- JSDoc comments, safe');

// ─── Verify: run local esbuild check on the specific files ────────────────────
console.log('\n--- Encoding check ---');
const files = [
  'src/components/DispatchBlast.tsx',
  'src/components/LoadSearchFilters.tsx',
  'src/components/ActivityLog.tsx',
  'src/pages/LeadFinder.tsx',
  'src/pages/DispatchTracker.tsx',
];
files.forEach(rel => {
  const c = read(rel);
  let enc = 0; for (let i=0;i<c.length;i++) if(c.charCodeAt(i)>127) enc++;
  console.log((enc===0?'CLEAN':'DIRTY') + ' ' + rel.split('/').pop());
});
console.log('\nDone.');
