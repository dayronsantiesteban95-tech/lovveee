const fs = require('fs');
const path = require('path');

function read(rel) { return fs.readFileSync(path.join(__dirname,'..', rel),'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(__dirname,'..', rel), c,'utf8'); }

const fixes = [
  ['src/components/dispatch/DriverSuggestionBadge.tsx', [
    ['title: "?? Driver assigned!",', 'title: "Driver assigned!",'],
  ]],
  ['src/components/QuickLoadEntry.tsx', [
    ['>??</span>', '></span>'],
  ]],
  ['src/hooks/useDispatchBlast.ts', [
    ['title: "?? Blast Sent!",',    'title: "Blast Sent!",'],
    ['title: "?? Interest sent!",', 'title: "Interest sent!",'],
  ]],
  ['src/pages/dispatch/DailyReport.tsx', [
    ['"??" : "??"', '"Day" : "Night"'],
  ]],
  ['src/pages/dispatch/LoadBoard.tsx', [
    ['"?? D?a" : "?? Noche"', '"Day" : "Night"'],
    ['title: "?? Invoice generated"', 'title: "Invoice generated"'],
  ]],
  ['src/pages/dispatch/NewLoadForm.tsx', [
    ['label: "?? AOG"',      'label: "AOG"'],
    ['label: "?? Standard"', 'label: "Standard"'],
  ]],
  ['src/pages/DispatchTracker.tsx', [
    ['title: "?? Driver Arrived"', 'title: "Driver Arrived"'],
    ['title: `?? Blast sent to ${driverCount}', 'title: `Blast sent to ${driverCount}'],
  ]],
  ['src/pages/DriverPerformance.tsx', [
    ['<span className="text-muted-foreground">???</span>', '<span className="text-muted-foreground">--</span>'],
    ['? "??"\n', '? "Good"\n'],
    ['? "??"\n', '? "OK"\n'],
    // Handle the rating badges (lines 481-485)
  ]],
  ['src/pages/DriverPortal.tsx', [
    ['title: "?? On Duty"',     'title: "On Duty"'],
    ['title: "?? Off Duty"',    'title: "Off Duty"'],
    ['"?? On Duty" : "?? Off Duty"', '"On Duty" : "Off Duty"'],
    ['title: "?? Call client"', 'title: "Call client"'],
    ['title: "?? POD captured!"', 'title: "POD captured!"'],
  ]],
  ['src/pages/FleetTracker.tsx', [
    ['title: `?? Car wash logged for', 'title: `Car wash logged for'],
  ]],
  ['src/pages/LeadFinder.tsx', [
    ['title: "?? Lead Imported + Sequence Started"', 'title: "Lead Imported + Sequence Started"'],
  ]],
  ['src/pages/NurtureEngine.tsx', [
    ['title: "?? Lead Replied!"',  'title: "Lead Replied!"'],
    ['note: `?? Auto-promoted',    'note: `Auto-promoted'],
    ['title: "?? Call Scheduled"', 'title: "Call Scheduled"'],
    ['title: `?? Auto-Pilot:',     'title: `Auto-Pilot:'],
    ['title: "?? Email Sent!"',    'title: "Email Sent!"'],
  ]],
  ['src/pages/RateCalculator.tsx', [
    ['title: "?? Quote Sent!"', 'title: "Quote Sent!"'],
  ]],
];

// DriverPerformance special case -- read and fix manually
let dp = read('src/pages/DriverPerformance.tsx');
dp = dp.replace(/<span className="text-muted-foreground">\?{2,}<\/span>/g, '<span className="text-muted-foreground">--</span>');
// Fix rating badge ?? patterns (lines 481-485 area)
dp = dp.replace(/\? "\?{2,}"\s*\n(\s*): "\?{2,}"\s*\n(\s*): "\?{2,}"/, ': "Good"\n$1: "Fair"\n$2: "Poor"');
// Any remaining standalone "??" strings
dp = dp.replace(/["'`]\?{2}["'`]/g, '""');
write('src/pages/DriverPerformance.tsx', dp);
console.log('[OK] DriverPerformance.tsx');

// Apply all other fixes
for (const [rel, replacements] of fixes) {
  let c = read(rel);
  let changed = 0;
  for (const [from, to] of replacements) {
    if (c.includes(from)) { c = c.split(from).join(to); changed++; }
  }
  write(rel, c);
  console.log('[' + (changed > 0 ? 'OK' : '--') + '] ' + rel.split('/').pop() + ' -- ' + changed + ' replacements');
}

// Verify all clean
console.log('\n--- Verification ---');
const allFiles = [...fixes.map(f=>f[0]), 'src/pages/DriverPerformance.tsx'];
const unique = [...new Set(allFiles)];
let allPass = true;
for (const rel of unique) {
  const c = read(rel);
  let enc = 0; for (let i=0;i<c.length;i++) if(c.charCodeAt(i)>127) enc++;
  const lines = c.split('\n');
  let artifacts = 0;
  lines.forEach(l => {
    if (/:\s*["'`]\?{2,}\s*\w/.test(l) || /["'`]\?{2,}["'`]/.test(l) || />\?{2,}</.test(l)) artifacts++;
  });
  const ok = enc === 0 && artifacts === 0;
  console.log((ok?'CLEAN':'DIRTY') + ' enc='+enc+' artifacts='+artifacts+' '+rel.split('/').pop());
  if (!ok) allPass = false;
}
console.log(allPass ? '\nAll clean.' : '\nWARNING: issues remain');
