import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function walk(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(f => {
    if (f === 'node_modules' || f === '.git' || f === 'dist') return;
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
    else if (f.match(/\.(tsx?|css|html|json)$/)) files.push(full);
  });
  return files;
}

const root = path.resolve(__dirname, '..');
const files = walk(root);
let errors = 0;
files.forEach(f => {
  const buf = fs.readFileSync(f);
  // Check for BOM
  if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    console.error('BOM detected:', f);
    errors++;
  }
  // Check for Latin-1 corrupted emoji pattern (f0 9f read as c3 b0 c2 9f)
  for (let i = 0; i < buf.length - 3; i++) {
    if (buf[i] === 0xC3 && buf[i+1] === 0xB0 && buf[i+2] === 0xC2) {
      console.error('Corrupted emoji detected at byte', i, 'in', f);
      errors++;
      break;
    }
  }
});
if (errors > 0) {
  console.error(`\n${errors} encoding issue(s) found. Run node scripts/fix-encoding.js to fix.`);
  process.exit(1);
} else {
  console.log('All files encoding clean.');
}
