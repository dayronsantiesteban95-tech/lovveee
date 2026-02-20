const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'InspectionForm.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const fixed = lines.map(line => {
  const trimmed = line.trim();

  // Decorative divider lines — mostly ?*??*? or similar garbage
  // Pattern: comment line with 10+ chars that are ?, *, or combinations
  if (trimmed.startsWith('//')) {
    const commentBody = trimmed.slice(2).trim();
    // Count ratio of junk chars vs total
    const junkChars = (commentBody.match(/[\?*]{1}/g) || []).length;
    const ratio = commentBody.length > 0 ? junkChars / commentBody.length : 0;
    if (ratio > 0.5 && commentBody.length > 15) {
      return '// ' + '-'.repeat(80);
    }
    // Section headers like: ?"??"? Types ?"??"?
    if (/\?"/.test(commentBody) || /"\?/.test(commentBody)) {
      // Extract the actual label word(s)
      const label = commentBody.replace(/[\?"*-]+/g, ' ').trim();
      if (label.length > 0 && label.length < 40) {
        return '// -- ' + label + ' --';
      }
      return '// ' + '-'.repeat(80);
    }
    // Title with stray ?
    if (commentBody.includes('INSPECTION FORM') && commentBody.includes('?')) {
      return '// INSPECTION FORM -- Vehicle Walk-Around Inspection';
    }
    // General: replace remaining ? in comments that look like replaced special chars
    // (isolated ? not part of ternary or optional chain — in comments it's always a replacement artifact)
    return line.replace(/\?[*"']+/g, '--');
  }

  return line;
});

const result = fixed.join('\n');
fs.writeFileSync(filePath, result, 'utf8');

// Verify
let bad = 0;
for (let i = 0; i < result.length; i++) {
  if (result.charCodeAt(i) > 127) bad++;
}
console.log('Non-ASCII remaining:', bad);
console.log(bad === 0 ? 'CLEAN' : 'STILL HAS ISSUES');

// Show first 30 lines to verify
console.log('\nFirst 30 lines:');
result.split('\n').slice(0, 30).forEach((l, i) => console.log((i+1) + ': ' + l));
