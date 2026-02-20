/**
 * Step 2 fixes:
 * 1. Add ErrorBoundary import + wrapper to all 5 critical pages
 * 2. Fix Dashboard any types (proper inline types for Supabase query results)
 * 3. Fix TeamManagement empty catch -> catch (_err) to silence linter
 */
const fs = require('fs');
const path = require('path');

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function writeFile(rel, content) {
  fs.writeFileSync(path.join(__dirname, '..', rel), content, 'utf8');
}

// ─── Helper: wrap a file's export default function with ErrorBoundary ─────────
// Renames: export default function Foo() -> function Foo()
// Adds:    export default function FooPage() { return <ErrorBoundary><Foo /></ErrorBoundary>; }
// Also adds the import at the top of the first import block
function addErrorBoundary(rel, fnName, importLine) {
  let content = readFile(rel);

  // 1. Add import if not present
  if (!content.includes('ErrorBoundary')) {
    // Insert after the first import line
    content = content.replace(
      /^(import .+)$/m,
      `$1\nimport { ErrorBoundary } from "@/components/ErrorBoundary";`
    );
  }

  // 2. Change export default function Foo() -> function Foo()
  content = content.replace(
    `export default function ${fnName}()`,
    `function ${fnName}()`
  );

  // 3. Append the page wrapper at the end (trim trailing newlines first)
  content = content.trimEnd();
  content += `\n\nexport default function ${fnName}Page() {\n  return (\n    <ErrorBoundary>\n      <${fnName} />\n    </ErrorBoundary>\n  );\n}\n`;

  writeFile(rel, content);
  console.log('  ErrorBoundary added to ' + rel);
}

// ─── 1. Billing ──────────────────────────────────────────────────────────────
console.log('\n[1/5] Billing.tsx');
addErrorBoundary('src/pages/Billing.tsx', 'Billing', '');

// ─── 2. FleetTracker ─────────────────────────────────────────────────────────
console.log('\n[2/5] FleetTracker.tsx');
addErrorBoundary('src/pages/FleetTracker.tsx', 'FleetTracker', '');

// ─── 3. PodManager ───────────────────────────────────────────────────────────
console.log('\n[3/5] PodManager.tsx');
addErrorBoundary('src/pages/PodManager.tsx', 'PodManager', '');

// ─── 4. TeamManagement ───────────────────────────────────────────────────────
console.log('\n[4/5] TeamManagement.tsx');
addErrorBoundary('src/pages/TeamManagement.tsx', 'TeamManagement', '');

// Also fix empty catch -> catch (_err) to silence linter
let tm = readFile('src/pages/TeamManagement.tsx');
tm = tm.replace(
  '      } catch {\n        // Edge Function unavailable',
  '      } catch (_err) {\n        // Edge Function unavailable'
);
writeFile('src/pages/TeamManagement.tsx', tm);
console.log('  Empty catch -> catch (_err) fixed in TeamManagement.tsx');

// ─── 5. Dashboard ────────────────────────────────────────────────────────────
console.log('\n[5/5] Dashboard.tsx');
addErrorBoundary('src/pages/Dashboard.tsx', 'Dashboard', '');

// Fix any types in Dashboard
let dash = readFile('src/pages/Dashboard.tsx');

// fetchActivityData: type the supabase result row properly
dash = dash.replace(
  `  const changedByIds = [...new Set((data ?? []).map((e: any) => e.changed_by).filter(Boolean))];`,
  `  type ActivityRow = { id: string; created_at: string; new_status: string; changed_by: string | null; load_id: string | null; daily_loads: { reference_number: string | null } | null };\n  const changedByIds = [...new Set((data ?? []).map((e: ActivityRow) => e.changed_by).filter(Boolean))];`
);
dash = dash.replace(
  `  return (data ?? []).map((e: any) => ({`,
  `  return (data ?? []).map((e: ActivityRow) => ({`
);

// fetchWeekStatsData: type the rows properly
dash = dash.replace(
  `  const revenue = rows.filter(r => r.status === "delivered" || r.status === "completed").reduce((s: number, r: any) => s + (r.revenue ?? 0), 0);`,
  `  const revenue = rows.filter(r => r.status === "delivered" || r.status === "completed").reduce((s: number, r) => s + ((r.revenue as number | null) ?? 0), 0);`
);
dash = dash.replace(
  `  const withETA = rows.filter((r: any) => (r.status === "delivered" || r.status === "completed") && r.estimated_delivery);`,
  `  const withETA = rows.filter((r) => (r.status === "delivered" || r.status === "completed") && r.estimated_delivery);`
);
dash = dash.replace(
  `  const onTime = withETA.filter((r: any) => r.end_time && r.end_time <= r.estimated_delivery).length;`,
  `  const onTime = withETA.filter((r) => r.end_time && r.end_time <= r.estimated_delivery).length;`
);
dash = dash.replace(
  `  for (const r of rows.filter((r: any) => (r.status === "delivered" || r.status === "completed") && r.driver_id)) {\n    const id = (r as any).driver_id;`,
  `  for (const r of rows.filter((r) => (r.status === "delivered" || r.status === "completed") && r.driver_id)) {\n    const id = r.driver_id as string;`
);

writeFile('src/pages/Dashboard.tsx', dash);
console.log('  any types cleaned up in Dashboard.tsx');

// ─── Verify encoding still clean ─────────────────────────────────────────────
console.log('\n--- Encoding check ---');
const files = [
  'src/pages/Billing.tsx',
  'src/pages/FleetTracker.tsx',
  'src/pages/PodManager.tsx',
  'src/pages/TeamManagement.tsx',
  'src/pages/Dashboard.tsx',
];
let allClean = true;
for (const f of files) {
  const c = readFile(f);
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  const status = bad === 0 ? 'CLEAN' : `BAD (${bad} chars)`;
  console.log(`  ${f}: ${status}`);
  if (bad > 0) allClean = false;
}

console.log('\n' + (allClean ? 'All files encoding clean.' : 'WARNING: encoding issues remain!'));
