/**
 * Step 4 fixes — Components
 * 1. Fix ? emoji artifacts in BlastLoadDialog + RouteOptimizerPanel (user-visible strings)
 * 2. Add error check to InspectionForm car wash insert
 * 3. Add error checks to BlastLoadDialog blast_responses + driver_notifications + load update
 * 4. Add error checks to RouteOptimizerPanel geocode save + route apply
 * 5. Add error check to InspectionForm comment artifact cleanup
 */
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(__dirname, '..', rel), c, 'utf8'); }
function check(rel) {
  const c = read(rel);
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  return bad;
}

// ─── 1. BlastLoadDialog -- fix emoji artifacts + add error checks ─────────────
console.log('[1] BlastLoadDialog.tsx');
let bld = read('src/components/BlastLoadDialog.tsx');

// Fix user-visible emoji ? artifacts
bld = bld.replace(`title: "?? New Load Available!",`, `title: "New Load Available!",`);
bld = bld.replace(`\`\${load.miles} mi ? $\${load.revenue}\``, '`' + `\${load.miles} mi | $\${load.revenue}` + '`');
bld = bld.replace(`title: "?? Blast Sent!",`, `title: "Blast Sent!",`);

// Add error check to blast_responses insert
bld = bld.replace(
  `            await supabase.from("blast_responses").insert(responseRows);`,
  `            const { error: respErr } = await supabase.from("blast_responses").insert(responseRows);\n            if (respErr) console.warn("blast_responses insert failed:", respErr.message);`
);

// Add error check to driver_notifications insert
bld = bld.replace(
  `            await supabase.from("driver_notifications").insert(notifRows);`,
  `            const { error: notifErr } = await supabase.from("driver_notifications").insert(notifRows);\n            if (notifErr) console.warn("driver_notifications insert failed:", notifErr.message);`
);

// Add error check to load status update
bld = bld.replace(
  `            await supabase\n                .from("daily_loads")\n                .update({ status: "blasted", updated_at: now })\n                .eq("id", load.id);`,
  `            const { error: blastUpdateErr } = await supabase\n                .from("daily_loads")\n                .update({ status: "blasted", updated_at: now })\n                .eq("id", load.id);\n            if (blastUpdateErr) console.warn("load blast status update failed:", blastUpdateErr.message);`
);

write('src/components/BlastLoadDialog.tsx', bld);
console.log('  [OK] emoji artifacts fixed, error checks added');
console.log('  encoding:', check('src/components/BlastLoadDialog.tsx') === 0 ? 'CLEAN' : 'DIRTY');

// ─── 2. InspectionForm -- add error check to car wash insert ─────────────────
console.log('\n[2] InspectionForm.tsx');
let inf = read('src/components/InspectionForm.tsx');

inf = inf.replace(
  `            if (carWashDone) {\n                await supabase.from("vehicle_car_washes").insert({`,
  `            if (carWashDone) {\n                const { error: washErr } = await supabase.from("vehicle_car_washes").insert({`
);
inf = inf.replace(
  `                    recorded_by: user?.id ?? null,\n                });\n            }`,
  `                    recorded_by: user?.id ?? null,\n                });\n                if (washErr) console.warn("car wash log failed:", washErr.message);\n            }`
);

// Fix the remaining comment artifact: ?--
inf = inf.replace(/\/\/ If car wash done \?-- log it/g, '// If car wash done -- log it');

write('src/components/InspectionForm.tsx', inf);
console.log('  [OK] car wash error check added, comment artifact fixed');
console.log('  encoding:', check('src/components/InspectionForm.tsx') === 0 ? 'CLEAN' : 'DIRTY');

// ─── 3. RouteOptimizerPanel -- add error checks + fix emoji artifacts ─────────
console.log('\n[3] RouteOptimizerPanel.tsx');
let rop = read('src/components/RouteOptimizerPanel.tsx');

// Fix emoji artifact in toast
rop = rop.replace(/title: `\?{1,3} Route optimized!`/, 'title: "Route optimized!"');
rop = rop.replace(/title: `\? Route applied`/, 'title: "Route applied"');
rop = rop.replace(/title: `\?{1,3}[^`]*`/g, (m) => m.replace(/\?+\s*/g, ''));

// Add error check to geocode save
rop = rop.replace(
  `                    // Save geocoded coordinates back to DB\n                    await supabase.from("daily_loads").update({`,
  `                    // Save geocoded coordinates back to DB\n                    const { error: geoSaveErr } = await supabase.from("daily_loads").update({`
);
rop = rop.replace(
  `                        delivery_lng: lng,\n                    }).eq("id", load.id);\n                }`,
  `                        delivery_lng: lng,\n                    }).eq("id", load.id);\n                    if (geoSaveErr) console.warn("geocode save failed:", geoSaveErr.message);\n                }`
);

// Add error check to route apply loop
rop = rop.replace(
  `        for (const stop of optimized.stops) {\n            await supabase.from("daily_loads").update({`,
  `        for (const stop of optimized.stops) {\n            const { error: applyErr } = await supabase.from("daily_loads").update({`
);
rop = rop.replace(
  `                estimated_arrival: stop.estimatedArrival,\n            }).eq("id", stop.id);\n        }`,
  `                estimated_arrival: stop.estimatedArrival,\n            }).eq("id", stop.id);\n            if (applyErr) console.warn("route apply failed for stop " + stop.id + ":", applyErr.message);\n        }`
);

write('src/components/RouteOptimizerPanel.tsx', rop);
console.log('  [OK] error checks added, emoji artifacts fixed');
console.log('  encoding:', check('src/components/RouteOptimizerPanel.tsx') === 0 ? 'CLEAN' : 'DIRTY');

// ─── 4. Scan all components for remaining ? artifacts in user-visible strings ─
console.log('\n[4] Scanning all components for remaining ? artifacts in strings...');
const compDir = path.join(__dirname, '..', 'src', 'components');
const compFiles = fs.readdirSync(compDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
let found = [];
for (const f of compFiles) {
  const c = fs.readFileSync(path.join(compDir, f), 'utf8');
  const lines = c.split('\n');
  lines.forEach((line, i) => {
    // Look for ? in string literals or JSX text (not in comments, not in ternaries/optionals)
    if (!line.trim().startsWith('//') && !line.trim().startsWith('*')) {
      const inString = line.match(/["'`][^"'`]*\?{2,}[^"'`]*["'`]/);
      if (inString) {
        found.push({ file: f, line: i+1, content: line.trim().substring(0, 100) });
      }
    }
  });
}
if (found.length === 0) {
  console.log('  No ?? artifacts in string literals.');
} else {
  found.forEach(f => console.log('  ' + f.file + ':' + f.line + ': ' + f.content));
}

// ─── 5. Final encoding check on all components ────────────────────────────────
console.log('\n[5] Final encoding check on all components...');
let allClean = true;
for (const f of compFiles) {
  const c = fs.readFileSync(path.join(compDir, f), 'utf8');
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  if (bad > 0) { console.log('  DIRTY: ' + f + ' (' + bad + ')'); allClean = false; }
}
console.log(allClean ? '  All components encoding clean.' : '  WARNING: encoding issues remain!');
