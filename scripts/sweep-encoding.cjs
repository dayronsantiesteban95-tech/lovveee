const fs = require('fs');
const path = require('path');

const DIRS = [
  path.join(__dirname, '..', 'src', 'pages'),
  path.join(__dirname, '..', 'src', 'components'),
  path.join(__dirname, '..', 'src', 'hooks'),
  path.join(__dirname, '..', 'src', 'lib'),
  path.join(__dirname, '..', 'src', 'integrations'),
  path.join(__dirname, '..', 'src', 'utils'),
];

function getAllTsx(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      results = results.concat(getAllTsx(full));
    } else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

function countNonAscii(str) {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 127) count++;
  }
  return count;
}

function fixEncoding(content) {
  // Em dash variants
  content = content.replace(/\u2014/g, '--');
  content = content.replace(/\u2013/g, '-');
  // Box-drawing characters
  content = content.replace(/[\u2500-\u257F]/g, '-');
  // Smart single quotes
  content = content.replace(/[\u2018\u2019]/g, "'");
  // Smart double quotes
  content = content.replace(/[\u201C\u201D]/g, '"');
  // Ellipsis
  content = content.replace(/\u2026/g, '...');
  // Non-breaking space
  content = content.replace(/\u00A0/g, ' ');
  // Bullet
  content = content.replace(/\u2022/g, '*');
  // Arrows
  content = content.replace(/\u2192/g, '->');
  content = content.replace(/\u2190/g, '<-');
  content = content.replace(/\u2194/g, '<->');
  // Checkmark / X
  content = content.replace(/\u2713/g, 'v');
  content = content.replace(/\u2714/g, 'v');
  content = content.replace(/\u2715/g, 'x');
  content = content.replace(/\u2716/g, 'x');
  // Any remaining non-ASCII — replace with '?'
  content = content.replace(/[^\x00-\x7F]/g, '?');
  return content;
}

let totalFixed = 0;
let totalFiles = 0;
let skipped = 0;
const report = [];

const allFiles = DIRS.flatMap(getAllTsx);

for (const file of allFiles) {
  const original = fs.readFileSync(file, 'utf8');
  const before = countNonAscii(original);

  if (before === 0) {
    skipped++;
    continue;
  }

  const fixed = fixEncoding(original);
  const after = countNonAscii(fixed);

  fs.writeFileSync(file, fixed, 'utf8');
  totalFixed += before;
  totalFiles++;
  report.push({ file: path.relative(path.join(__dirname, '..'), file), before, after });
}

console.log('\n=== ENCODING SWEEP COMPLETE ===\n');
console.log(`Files fixed:   ${totalFiles}`);
console.log(`Files clean:   ${skipped}`);
console.log(`Chars fixed:   ${totalFixed}`);
console.log('\nPer-file breakdown:');
report.forEach(r => {
  const status = r.after === 0 ? 'CLEAN' : `REMAINING: ${r.after}`;
  console.log(`  ${r.file.padEnd(60)} ${r.before} -> ${r.after}  [${status}]`);
});

const stillDirty = report.filter(r => r.after > 0);
if (stillDirty.length > 0) {
  console.log('\nWARNING: These files still have non-ASCII chars:');
  stillDirty.forEach(r => console.log(`  ${r.file}: ${r.after} chars`));
  process.exit(1);
} else {
  console.log('\nAll files clean.');
}
