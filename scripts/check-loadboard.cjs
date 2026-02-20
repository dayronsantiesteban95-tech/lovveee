const fs = require('fs');
const lines = fs.readFileSync('src/pages/dispatch/LoadBoard.tsx','utf8').split('\n');
lines.forEach((l,i) => {
  if (/:\s*["'`]\?{2,}\s*\w/.test(l) || /["'`]\?{2,}["'`]/.test(l) || />\?{2,}</.test(l)) {
    console.log('L'+(i+1)+': '+l.trim().substring(0,120));
  }
});
