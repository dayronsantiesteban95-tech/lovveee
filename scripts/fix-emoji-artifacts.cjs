/**
 * Fix emoji artifacts (??, ??, ???, etc.) in user-visible strings across all components.
 * These were emojis that the encoding sweep replaced with '?'.
 * Strategy: replace known patterns with clean text equivalents.
 */
const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(__dirname, '..', rel), c, 'utf8'); }

const fixes = [
  // ─── ActivityLog.tsx ────────────────────────────────────────────────────────
  ['src/components/ActivityLog.tsx', [
    ['new_status} ? "', 'new_status}: "'],
    ['?? "No ref"} ? ${load.client_name', '?? "No ref"} | ${load.client_name'],
    ['?? "Unknown client"} ? ${load.st', '?? "Unknown client"} | ${load.st'],
  ]],

  // ─── AutoDispatchPanel.tsx ──────────────────────────────────────────────────
  ['src/components/AutoDispatchPanel.tsx', [
    [`title: "?? Driver assigned!",`, `title: "Driver assigned!",`],
  ]],

  // ─── CommandBar.tsx ─────────────────────────────────────────────────────────
  ['src/components/CommandBar.tsx', [
    [`{ badge: "?? In Transit"`, `{ badge: "In Transit"`],
    [`{ badge: "?? Picked Up"`, `{ badge: "Picked Up"`],
    [`{ badge: "?? Assigned"`, `{ badge: "Assigned"`],
    [`"?? Active"`, `"Active"`],
    [`"? Inactive"`, `"Inactive"`],
    ['`${c.company ?? ""} ? ${c.email ?? ""}`.trim().replace(/^?\\s*/, "")', '`${c.company ?? ""} ${c.email ? "| " + c.email : ""}`.trim()'],
  ]],

  // ─── CSVImportPanel.tsx ─────────────────────────────────────────────────────
  ['src/components/CSVImportPanel.tsx', [
    [`title: \`?? Import complete\``, `title: "Import complete"`],
  ]],

  // ─── DispatchBlast.tsx ──────────────────────────────────────────────────────
  ['src/components/DispatchBlast.tsx', [
    [`icon: "??", defaul`, `icon: "—", defaul`],
  ]],

  // ─── DriverPickerModal.tsx ──────────────────────────────────────────────────
  ['src/components/DriverPickerModal.tsx', [
    [`if (s === "idle" || s === "active") return "??";`, `if (s === "idle" || s === "active") return "Active";`],
    [`if (s === "finishing_soon" || s === "on_load" || s === "in_progress") return "??";`, `if (s === "finishing_soon" || s === "on_load" || s === "in_progress") return "On Load";`],
    [`return "??";`, `return "Inactive";`],
  ]],

  // ─── InspectionForm.tsx ─────────────────────────────────────────────────────
  ['src/components/InspectionForm.tsx', [
    ['`?? ??? Odometer is lower', '`Warning: Odometer is lower'],
    ['`?????? Same as last reading', '`Note: Same as last reading'],
    [`toast({ title: "Notes required", description: "Exterior damage was marked ??"`, `toast({ title: "Notes required", description: "Exterior damage was marked -- please describe it in`],
    [`toast({ title: "??... Inspection submitted!"`, `toast({ title: "Inspection submitted!"`],
    ['`${v.license_plate}` : ""}', '`${v.license_plate}` : ""}'],
    ['{v.vehicle_name}{v.license_plate ? ` ??" ${v.license_plate}` : ""}', '{v.vehicle_name}{v.license_plate ? ` -- ${v.license_plate}` : ""}'],
    ['<SelectItem value="">??" None ??"</SelectItem>', '<SelectItem value="">-- None --</SelectItem>'],
    ['{i < photos.length ? "??"" : `${i + 1}`}', '{i < photos.length ? "+" : `${i + 1}`}'],
  ]],

  // ─── IntegrationSyncPanel.tsx ───────────────────────────────────────────────
  ['src/components/IntegrationSyncPanel.tsx', [
    [`title: \`?? Synced with warnings\``, `title: "Synced with warnings"`],
  ]],

  // ─── LeadDetailPanel.tsx ────────────────────────────────────────────────────
  ['src/components/LeadDetailPanel.tsx', [
    [`"Caliente ??"`, `"Caliente"`],
    [`"Tibio "`, `"Tibio"`],
    [`"Fr?o D"`, `"Frio"`],
    [`label="Veh?culo"`, `label="Vehiculo"`],
  ]],

  // ─── LiveDriverMap.tsx ──────────────────────────────────────────────────────
  ['src/components/LiveDriverMap.tsx', [
    [`n[0] ?? ""`,'n[0] ?? ""'],  // this is fine -- ?? is nullish coalescing
    [`color:#60a5fa;">?`, `color:#60a5fa;">`],
  ]],

  // ─── LoadDetailPanel.tsx ────────────────────────────────────────────────────
  ['src/components/LoadDetailPanel.tsx', [
    [`toast({ title: "?? Invoice generated"`, `toast({ title: "Invoice generated"`],
    [`toast({ title: "?? Link copied!"`, `toast({ title: "Link copied!"`],
    [`load.shift === "day" ? "?? Day" : "?? Night"`, `load.shift === "day" ? "Day" : "Night"`],
  ]],

  // ─── LoadSearchFilters.tsx ──────────────────────────────────────────────────
  ['src/components/LoadSearchFilters.tsx', [
    [`{ value: "AOG", label: "?? AOG" }`, `{ value: "AOG", label: "AOG" }`],
    [`{ value: "Standard", label: "?? Standard" }`, `{ value: "Standard", label: "Standard" }`],
  ]],

  // ─── QuickLoadEntry.tsx ─────────────────────────────────────────────────────
  ['src/components/QuickLoadEntry.tsx', [
    [`{ value: "standard", label: "Standard Delivery", icon: "??" }`, `{ value: "standard", label: "Standard Delivery", icon: "" }`],
    [`{ value: "rush", label: "Rush / Hot Shot", icon: "??" }`, `{ value: "rush", label: "Rush / Hot Shot", icon: "" }`],
    [`{ value: "scheduled", label: "Scheduled", icon: "??" }`, `{ value: "scheduled", label: "Scheduled", icon: "" }`],
    [`{ value: "round_trip", label: "Round Trip", icon: "??" }`, `{ value: "round_trip", label: "Round Trip", icon: "" }`],
    [`{ value: "white_glove", label: "White Glove", icon: "??" }`, `{ value: "white_glove", label: "White Glove", icon: "" }`],
  ]],

  // ─── RouteOptimizerPanel.tsx ────────────────────────────────────────────────
  ['src/components/RouteOptimizerPanel.tsx', [
    [`title: "?? Copied"`, `title: "Copied"`],
  ]],
];

let totalFiles = 0;
for (const [rel, replacements] of fixes) {
  let content = read(rel);
  let changed = 0;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed++;
    }
  }
  if (changed > 0) {
    write(rel, content);
    totalFiles++;
    console.log(`[OK] ${rel.split('/').pop()} -- ${changed} replacements`);
  } else {
    console.log(`[--] ${rel.split('/').pop()} -- no matches (already clean or pattern changed)`);
  }
}

// Final encoding + artifact scan
console.log('\n=== Final verification ===');
const compDir = path.join(__dirname, '..', 'src', 'components');
const compFiles = fs.readdirSync(compDir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));
let encDirty = 0;
for (const f of compFiles) {
  const c = fs.readFileSync(path.join(compDir, f), 'utf8');
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  if (bad > 0) { console.log('  ENC DIRTY: ' + f + ' (' + bad + ')'); encDirty++; }
}
console.log(encDirty === 0 ? 'Encoding: all clean.' : `Encoding: ${encDirty} files dirty.`);
console.log(`\nDone. ${totalFiles} files updated.`);
