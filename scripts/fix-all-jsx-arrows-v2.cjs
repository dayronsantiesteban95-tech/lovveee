/**
 * V2 -- comprehensive fix for -> and <- in JSX text.
 * Covers ALL patterns: between tags, in button text, in spans, in any JSX text node.
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

// Strategy: scan every line. If the line is a JSX text-only line (no JS expressions,
// no import/type/interface, not a comment) and contains -> or <-, replace them.
// A "JSX text line" is one that is just indented text with no { } and ends before a </tag>
// or is between two JSX elements.

function fixLine(line) {
  const trimmed = line.trim();

  // Skip pure code lines
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') || trimmed.startsWith('type ') || trimmed.startsWith('interface ') ||
      trimmed.startsWith('const ') || trimmed.startsWith('let ') || trimmed.startsWith('return (') ||
      trimmed.startsWith('function ') || trimmed.startsWith('async ') || trimmed.startsWith('=>')) {
    return line;
  }

  // If line contains -> or <- AND looks like JSX text (not a JS expression)
  // JSX text lines: contain no { or have text that is clearly human-readable
  if (!line.includes('->') && !line.includes('<-')) return line;

  // Skip lines that are clearly JS/TS (have = assignments, function calls, etc.)
  if (/^\s*(const|let|var|if|for|while|return|throw|await|async)\b/.test(trimmed)) return line;
  if (/[=!<>]=/.test(line) && !/->|<-/.test(line)) return line; // comparison operators but no arrows

  // Replace -> with &rarr; and <- with &larr; in JSX text context
  // Be careful: don't replace inside {expressions} or in attribute values that are JS
  let result = line;

  // Replace text between JSX tags: >...->...</ or just text lines
  // Pattern 1: text inside JSX tags ><text><
  result = result.replace(/>([^<{]+)</g, (match, text) => {
    if (text.includes('->') || text.includes('<-')) {
      return '>' + text.replace(/->/g, '&rarr;').replace(/<-/g, '&larr;') + '<';
    }
    return match;
  });

  // Pattern 2: standalone text line (just indented text, no tags)
  // e.g. "                View Task Board ->"
  if (/^\s+[A-Za-z].*(->{1}|<-{1})/.test(line) && !/<[A-Za-z]/.test(trimmed) && !trimmed.includes('{')) {
    result = result.replace(/->/g, '&rarr;').replace(/<-/g, '&larr;');
  }

  return result;
}

const files = getAllFiles(path.join(__dirname, '..', 'src'));
let totalFixed = 0;
let filesFixed = [];

for (const f of files) {
  const original = fs.readFileSync(f, 'utf8');
  const lines = original.split('\n');
  const fixed = lines.map(fixLine);
  const content = fixed.join('\n');

  if (content !== original) {
    fs.writeFileSync(f, content, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), f);
    filesFixed.push(rel);
    totalFixed++;
  }
}

console.log('Files fixed: ' + totalFixed);
filesFixed.forEach(f => console.log('  ' + f));

// Verify
console.log('\n--- Remaining -> in JSX text ---');
let remaining = [];
for (const f of files) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    // Only flag lines that look like JSX text (not code)
    if ((trimmed.includes('->') || trimmed.includes('<-')) &&
        !trimmed.startsWith('//') && !trimmed.startsWith('*') &&
        !trimmed.startsWith('import') && !trimmed.startsWith('const') &&
        !trimmed.startsWith('let') && !trimmed.startsWith('if') &&
        !trimmed.startsWith('return') && !/[=!]=/.test(line) &&
        !trimmed.startsWith('{') && !trimmed.startsWith('=>')) {
      remaining.push(path.relative(path.join(__dirname, '..'), f) + ':L' + (i+1) + ': ' + trimmed.substring(0, 100));
    }
  });
}
console.log('Remaining: ' + remaining.length);
remaining.forEach(r => console.log('  ' + r));
console.log(remaining.length === 0 ? 'CLEAN' : 'REVIEW MANUALLY');
