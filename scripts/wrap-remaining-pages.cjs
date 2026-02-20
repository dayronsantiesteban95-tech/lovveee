const fs = require('fs');
const path = require('path');

const targets = [
  ['src/pages/Auth.tsx',                     'Auth'],
  ['src/pages/CalendarView.tsx',             'CalendarView'],
  ['src/pages/dispatch/DailyReport.tsx',     'DailyReport'],
  ['src/pages/dispatch/EditLoadDialog.tsx',  'EditLoadDialog'],
  ['src/pages/dispatch/LiveOpsTab.tsx',      'LiveOpsTab'],
  ['src/pages/dispatch/LoadBoard.tsx',       'LoadBoard'],
  ['src/pages/dispatch/NewLoadForm.tsx',     'NewLoadForm'],
  ['src/pages/dispatch/WaitTimeTab.tsx',     'WaitTimeTab'],
  ['src/pages/legal/PrivacyPolicy.tsx',      'PrivacyPolicy'],
  ['src/pages/legal/TermsOfService.tsx',     'TermsOfService'],
];

for (const [rel, fn] of targets) {
  const fullPath = path.join(__dirname, '..', rel);
  let c = fs.readFileSync(fullPath, 'utf8');

  if (c.includes('ErrorBoundary')) {
    console.log('[SKIP] ' + fn + ' -- already has ErrorBoundary');
    continue;
  }

  if (!c.includes('export default function ' + fn)) {
    const match = c.match(/export default function (\w+)/);
    console.log('[SKIP] ' + fn + ' -- export is: ' + (match ? match[1] : 'none/default'));
    continue;
  }

  // Add import after first import line
  c = c.replace(/^(import .+)$/m, '$1\nimport { ErrorBoundary } from "@/components/ErrorBoundary";');

  // Rename inner fn
  c = c.replace('export default function ' + fn + '()', 'function ' + fn + '()');

  // Append page wrapper
  c = c.trimEnd();
  c += '\n\nexport default function ' + fn + 'Page() {\n  return (\n    <ErrorBoundary>\n      <' + fn + ' />\n    </ErrorBoundary>\n  );\n}\n';

  fs.writeFileSync(fullPath, c, 'utf8');
  console.log('[OK] ' + fn + ' wrapped');
}

console.log('\nDone.');
