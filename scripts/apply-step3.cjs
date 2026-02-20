/**
 * Step 3 fixes:
 * 1. ErrorBoundary wrapper on all 14 remaining pages
 * 2. Missing error handling on unguarded Supabase calls
 * 3. Fix Pipeline delete with no error check
 * 4. Fix TaskBoard drag/drop + delete with no error check
 * 5. Fix DriverPortal missing error checks on shift update + POD confirm
 */
const fs = require('fs');
const path = require('path');

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8');
}
function writeFile(rel, content) {
  fs.writeFileSync(path.join(__dirname, '..', rel), content, 'utf8');
}

// ─── ErrorBoundary wrapper helper ────────────────────────────────────────────
function addErrorBoundary(rel, fnName) {
  let content = readFile(rel);
  if (content.includes('ErrorBoundary')) {
    console.log('  [SKIP] ' + rel + ' already has ErrorBoundary');
    return;
  }
  // Add import after first import line
  content = content.replace(
    /^(import .+)$/m,
    `$1\nimport { ErrorBoundary } from "@/components/ErrorBoundary";`
  );
  // Change export default function Foo() -> function Foo()
  content = content.replace(
    `export default function ${fnName}()`,
    `function ${fnName}()`
  );
  // Append page wrapper
  content = content.trimEnd();
  content += `\n\nexport default function ${fnName}Page() {\n  return (\n    <ErrorBoundary>\n      <${fnName} />\n    </ErrorBoundary>\n  );\n}\n`;
  writeFile(rel, content);
  console.log('  [OK] ErrorBoundary added to ' + rel);
}

const pages = [
  ['src/pages/DispatchTracker.tsx',    'DispatchTracker'],
  ['src/pages/DriverPerformance.tsx',  'DriverPerformance'],
  ['src/pages/TimeClock.tsx',          'TimeClock'],
  ['src/pages/Companies.tsx',          'Companies'],
  ['src/pages/DriverPortal.tsx',       'DriverPortal'],
  ['src/pages/TrackDelivery.tsx',      'TrackDelivery'],
  ['src/pages/NurtureEngine.tsx',      'NurtureEngine'],
  ['src/pages/Pipeline.tsx',           'Pipeline'],
  ['src/pages/TaskBoard.tsx',          'TaskBoard'],
  ['src/pages/RateCalculator.tsx',     'RateCalculator'],
  ['src/pages/SopWiki.tsx',            'SopWiki'],
  ['src/pages/Contacts.tsx',           'Contacts'],
  ['src/pages/LeadFinder.tsx',         'LeadFinder'],
  ['src/pages/QuickBooksCallback.tsx', 'QuickBooksCallback'],
];

console.log('\n=== STEP 1: ErrorBoundary on all 14 pages ===');
for (const [rel, fn] of pages) {
  addErrorBoundary(rel, fn);
}

// ─── STEP 2: Fix Pipeline delete with no error check ────────────────────────
console.log('\n=== STEP 2: Pipeline delete error check ===');
let pl = readFile('src/pages/Pipeline.tsx');
pl = pl.replace(
  `    await supabase.from("leads").delete().eq("id", deleteId);`,
  `    const { error: delErr } = await supabase.from("leads").delete().eq("id", deleteId);\n    if (delErr) { toast({ title: "Error", description: delErr.message, variant: "destructive" }); return; }`
);
writeFile('src/pages/Pipeline.tsx', pl);
console.log('  [OK] Pipeline delete now has error check');

// ─── STEP 3: Fix TaskBoard unguarded calls ───────────────────────────────────
console.log('\n=== STEP 3: TaskBoard error checks ===');
let tb = readFile('src/pages/TaskBoard.tsx');

// Drag/drop status update (L94 area)
tb = tb.replace(
  `    await supabase.from("tasks").update({ status }).eq("id", draggedId);`,
  `    const { error: dragErr } = await supabase.from("tasks").update({ status }).eq("id", draggedId);\n    if (dragErr) toast({ title: "Error updating task", description: dragErr.message, variant: "destructive" });`
);

// task_lead_links insert (L146 area)
tb = tb.replace(
  `        await supabase.from("task_lead_links").insert({ task_id: newTask.id, lead_id: leadId });`,
  `        const { error: linkErr } = await supabase.from("task_lead_links").insert({ task_id: newTask.id, lead_id: leadId });\n        if (linkErr) console.warn("task_lead_links insert failed:", linkErr.message);`
);

// delete (L160 area)
tb = tb.replace(
  `    await supabase.from("tasks").delete().eq("id", deleteId);`,
  `    const { error: delErr } = await supabase.from("tasks").delete().eq("id", deleteId);\n    if (delErr) { toast({ title: "Error deleting task", description: delErr.message, variant: "destructive" }); return; }`
);
writeFile('src/pages/TaskBoard.tsx', tb);
console.log('  [OK] TaskBoard drag/delete now has error checks');

// ─── STEP 4: Fix DriverPortal missing error checks ──────────────────────────
console.log('\n=== STEP 4: DriverPortal error checks ===');
let dp = readFile('src/pages/DriverPortal.tsx');

// Shift update (L186 area) -- wrap in error check
dp = dp.replace(
  `      await supabase.from("driver_shifts").update({`,
  `      const { error: shiftErr } = await supabase.from("driver_shifts").update({`
);
// Find the closing of that update call and add error check
dp = dp.replace(
  /const \{ error: shiftErr \} = await supabase\.from\("driver_shifts"\)\.update\(\{([^}]+)\}\)\.eq\("id",([^;]+)\);/s,
  (match) => match + '\n      if (shiftErr) { toast({ title: "Error updating shift", description: shiftErr.message, variant: "destructive" }); return; }'
);

// load_status_events insert (L226 area)
dp = dp.replace(
  `      await supabase.from("load_status_events").insert({`,
  `      const { error: evtErr } = await supabase.from("load_status_events").insert({`
);
dp = dp.replace(
  /const \{ error: evtErr \} = await supabase\.from\("load_status_events"\)\.insert\(\{([^}]+)\}\);/s,
  (match) => match + '\n      if (evtErr) console.warn("load_status_events insert failed:", evtErr.message);'
);

// POD confirm update (L451 area)
dp = dp.replace(
  `      await supabase.from("daily_loads").update({ pod_confirmed: true }).eq("id", load.id);`,
  `      const { error: podErr } = await supabase.from("daily_loads").update({ pod_confirmed: true }).eq("id", load.id);\n      if (podErr) console.warn("POD confirm update failed:", podErr.message);`
);
writeFile('src/pages/DriverPortal.tsx', dp);
console.log('  [OK] DriverPortal shift/event/POD now has error checks');

// ─── STEP 5: Fix SopWiki delete with no error check ─────────────────────────
console.log('\n=== STEP 5: SopWiki delete error check ===');
let sop = readFile('src/pages/SopWiki.tsx');
sop = sop.replace(
  `    await supabase.from("sop_articles").delete().eq("id", deleteId);`,
  `    const { error: delErr } = await supabase.from("sop_articles").delete().eq("id", deleteId);\n    if (delErr) { toast({ title: "Error deleting article", description: delErr.message, variant: "destructive" }); return; }`
);
writeFile('src/pages/SopWiki.tsx', sop);
console.log('  [OK] SopWiki delete now has error check');

// ─── STEP 6: Encoding verification ──────────────────────────────────────────
console.log('\n=== Encoding check ===');
let allClean = true;
for (const [rel] of pages) {
  const c = readFile(rel);
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  const status = bad === 0 ? 'CLEAN' : `BAD(${bad})`;
  console.log('  ' + rel.split('/').pop().padEnd(30) + status);
  if (bad > 0) allClean = false;
}
console.log(allClean ? '\nAll clean.' : '\nWARNING: encoding issues!');
