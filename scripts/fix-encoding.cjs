const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'LiveDriverMap.tsx');
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\u2014/g, '--');
content = content.replace(/[\u2500-\u257F]/g, '-');
content = content.replace(/[\u2018\u2019]/g, "'");
content = content.replace(/[\u201C\u201D]/g, '"');
content = content.replace(/[^\x00-\x7F]/g, '?');

fs.writeFileSync(filePath, content, 'utf8');

let remaining = 0;
for (let i = 0; i < content.length; i++) {
  if (content.charCodeAt(i) > 127) remaining++;
}
console.log('Remaining non-ASCII chars:', remaining);
console.log(remaining === 0 ? 'CLEAN -- all encoding issues fixed' : 'STILL HAS ISSUES');
