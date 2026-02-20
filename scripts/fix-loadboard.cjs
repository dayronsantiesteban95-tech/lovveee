const fs = require('fs');
let c = fs.readFileSync('src/pages/dispatch/LoadBoard.tsx', 'utf8');
c = c.replace('title: "?? Load cloned"', 'title: "Load cloned"');
fs.writeFileSync('src/pages/dispatch/LoadBoard.tsx', c, 'utf8');
const lines = c.split('\n');
let remaining = 0;
lines.forEach(l => {
  if (/:\s*["'`]\?{2,}\s*\w/.test(l) || /["'`]\?{2,}["'`]/.test(l) || />\?{2,}</.test(l)) remaining++;
});
console.log('Remaining artifacts:', remaining, remaining === 0 ? 'CLEAN' : 'DIRTY');
