const fs = require('fs');
let c = fs.readFileSync('src/components/CommandBar.tsx', 'utf8');
// Replace ?? keyboard shortcut with Cmd text
c = c.replace(
  '<kbd className="px-1 rounded bg-muted border font-mono">??</kbd> Navigate',
  '<kbd className="px-1 rounded bg-muted border font-mono">Cmd+K</kbd> Navigate'
);
fs.writeFileSync('src/components/CommandBar.tsx', c, 'utf8');
const lines = c.split('\n');
let remaining = 0;
lines.forEach(l => {
  if (/:\s*["'`]\?{2,}\s*\w/.test(l) || /["'`]\?{2,}["'`]/.test(l) || />\?{2,}</.test(l)) remaining++;
});
console.log('Remaining artifacts:', remaining, remaining === 0 ? 'CLEAN' : 'DIRTY');
