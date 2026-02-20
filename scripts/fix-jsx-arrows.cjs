const fs = require('fs');
const path = require('path');

// Files with JSX arrow issues
const fixes = [
  ['src/pages/QuickBooksCallback.tsx',  '<- Go back to Billing',  '&larr; Go back to Billing'],
  ['src/components/BlastLoadDialog.tsx', '<span className="mx-1">-></span>',                        '<span className="mx-1">&rarr;</span>'],
  ['src/pages/Dashboard.tsx',           '<span className="text-muted-foreground/50 mx-1">-></span>', '<span className="text-muted-foreground/50 mx-1">&rarr;</span>'],
  ['src/pages/Dashboard.tsx',           '<span className="text-muted-foreground mx-1">-></span>',   '<span className="text-muted-foreground mx-1">&rarr;</span>'],
  ['src/pages/PodManager.tsx',          '<span className="text-muted-foreground">-></span>',         '<span className="text-muted-foreground">&rarr;</span>'],
];

// Track per-file changes
const fileChanges = {};
for (const [rel, from, to] of fixes) {
  if (!fileChanges[rel]) fileChanges[rel] = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  // Replace ALL occurrences
  fileChanges[rel] = fileChanges[rel].split(from).join(to);
}

// Write all files
for (const [rel, content] of Object.entries(fileChanges)) {
  fs.writeFileSync(path.join(__dirname, '..', rel), content, 'utf8');
  console.log('[OK] ' + rel.split('/').pop());
}

// Verify no remaining JSX arrow issues
const allFixed = Object.keys(fileChanges);
console.log('\n--- Verification ---');
let clean = true;
for (const rel of allFixed) {
  const c = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
  const lines = c.split('\n');
  const remaining = lines.filter((l, i) => !l.trim().startsWith('//') && />\s*<-|>\s*->/.test(l));
  console.log(rel.split('/').pop() + ': ' + (remaining.length === 0 ? 'CLEAN' : 'ISSUES: ' + remaining.length));
  if (remaining.length > 0) clean = false;
}
console.log(clean ? '\nAll JSX arrows fixed.' : '\nWARNING: issues remain');
