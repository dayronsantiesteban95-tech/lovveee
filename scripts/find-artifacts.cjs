const fs = require('fs');
const files = [
  'src/components/dispatch/DriverSuggestionBadge.tsx',
  'src/components/QuickLoadEntry.tsx',
  'src/hooks/useDispatchBlast.ts',
  'src/pages/dispatch/DailyReport.tsx',
  'src/pages/dispatch/LoadBoard.tsx',
  'src/pages/dispatch/NewLoadForm.tsx',
  'src/pages/DispatchTracker.tsx',
  'src/pages/DriverPerformance.tsx',
  'src/pages/DriverPortal.tsx',
  'src/pages/FleetTracker.tsx',
  'src/pages/LeadFinder.tsx',
  'src/pages/NurtureEngine.tsx',
  'src/pages/RateCalculator.tsx',
];
files.forEach(f => {
  const lines = fs.readFileSync(f,'utf8').split('\n');
  const hits = [];
  lines.forEach((l,i) => {
    if (/:\s*["'`]\?{2,}\s*\w/.test(l) || /["'`]\?{2,}["'`]/.test(l) || />\?{2,}</.test(l)) {
      hits.push('  L'+(i+1)+': '+l.trim().substring(0,120));
    }
  });
  if (hits.length) { console.log('--- '+f.split('/').pop()+' ---'); hits.forEach(h=>console.log(h)); }
});
