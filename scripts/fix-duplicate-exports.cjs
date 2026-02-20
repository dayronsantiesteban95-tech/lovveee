/**
 * Fix duplicate export default in dispatch sub-components.
 * These files receive props -- they are NOT top-level route pages.
 * Remove the erroneously added ErrorBoundary wrapper + import.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'src/pages/dispatch/DailyReport.tsx',
  'src/pages/dispatch/EditLoadDialog.tsx',
  'src/pages/dispatch/LiveOpsTab.tsx',
  'src/pages/dispatch/LoadBoard.tsx',
  'src/pages/dispatch/NewLoadForm.tsx',
  'src/pages/dispatch/WaitTimeTab.tsx',
];

for (const rel of files) {
  const fullPath = path.join(__dirname, '..', rel);
  let content = fs.readFileSync(fullPath, 'utf8');
  const fn = rel.split('/').pop().replace('.tsx', '');

  // 1. Remove the ErrorBoundary import line (only the one we added)
  content = content.replace(
    /\nimport \{ ErrorBoundary \} from "@\/components\/ErrorBoundary";\n/,
    '\n'
  );

  // 2. Remove the Page wrapper function and everything after it
  // Pattern: \n\nexport default function FooPage() {\n  return (\n    <ErrorBoundary>...
  const pageWrapperRegex = /\n\nexport default function \w+Page\(\) \{\n  return \(\n    <ErrorBoundary>\n      <\w+ \/>\n    <\/ErrorBoundary>\n  \);\n}\n?$/;
  content = content.replace(pageWrapperRegex, '\n');

  // 3. Verify we now have exactly 1 export default
  const exportCount = (content.match(/export default/g) || []).length;

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('[' + (exportCount === 1 ? 'OK' : 'STILL BROKEN:'+exportCount) + '] ' + fn + ' -- exports: ' + exportCount);
}

// Final check -- scan all dispatch pages
console.log('\n--- Verification ---');
const dispatchDir = path.join(__dirname, '..', 'src/pages/dispatch');
const dispFiles = fs.readdirSync(dispatchDir).filter(f => f.endsWith('.tsx'));
let allOk = true;
for (const f of dispFiles) {
  const c = fs.readFileSync(path.join(dispatchDir, f), 'utf8');
  const count = (c.match(/export default/g) || []).length;
  const ok = count <= 1;
  console.log((ok ? 'OK' : 'BROKEN') + ' ' + f + ' (' + count + ' exports)');
  if (!ok) allOk = false;
}
console.log(allOk ? '\nAll clean.' : '\nISSUES REMAIN');
