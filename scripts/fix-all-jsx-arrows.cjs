/**
 * Fix ALL -> and <- occurrences in JSX text nodes.
 * These cause esbuild parse errors because < and > are reserved in JSX.
 * Replace with HTML entities: -> becomes &rarr;, <- becomes &larr;
 */
const fs = require('fs');
const path = require('path');

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? getAllFiles(path.join(dir, e.name)) :
    e.name.endsWith('.tsx') ? [path.join(dir, e.name)] : []
  );
}

const files = getAllFiles(path.join(__dirname, '..', 'src'));
let totalFixed = 0;
let filesFixed = [];

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8');
  let content = original;

  // Replace -> in JSX text nodes (between > and <, or in string literals in JSX)
  // Strategy: replace ALL -> with &rarr; and <- with &larr; in .tsx files
  // EXCEPT: inside JS expressions {...}, comments, and import/type statements
  // Safe approach: replace in JSX text positions only

  const lines = content.split('\n');
  let changed = false;
  const fixed = lines.map(line => {
    // Skip pure JS lines (no JSX angle brackets for content)
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ') || trimmed.startsWith('type ') || trimmed.startsWith('interface ')) return line;

    // Fix -> in JSX text: pattern is text content between > and <
    // e.g. >Tools panel -> New to add<
    let newLine = line;

    // Pattern: JSX text node containing ->
    // Match: text after > that contains -> before a < 
    newLine = newLine.replace(/>([^<{]+)</g, (match, text) => {
      if (text.includes('->') || text.includes('<-')) {
        const fixedText = text.replace(/->/g, '&rarr;').replace(/<-/g, '&larr;');
        return '>' + fixedText + '<';
      }
      return match;
    });

    // Pattern: JSX string prop or text containing -> between quotes in JSX context
    // e.g. description="Go back -> billing"
    // Only fix if clearly in JSX context (line has JSX tags)
    if (newLine !== line) changed = true;
    return newLine;
  });

  if (changed) {
    content = fixed.join('\n');
    fs.writeFileSync(f, content, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), f);
    filesFixed.push(rel);
    totalFixed++;
  }
}

console.log('Files fixed: ' + totalFixed);
filesFixed.forEach(f => console.log('  ' + f));

// Verify -- scan for remaining -> in JSX text
console.log('\n--- Remaining issues ---');
const allFiles = getAllFiles(path.join(__dirname, '..', 'src'));
let remaining = [];
for (const f of allFiles) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/>([^<{]*(->|<-)[^<{]*)</.test(line)) {
      remaining.push(path.relative(path.join(__dirname, '..'), f) + ':L' + (i+1) + ': ' + line.trim().substring(0, 100));
    }
  });
}
console.log('Remaining JSX arrow issues: ' + remaining.length);
remaining.forEach(r => console.log('  ' + r));
console.log(remaining.length === 0 ? 'CLEAN' : 'ISSUES REMAIN');
