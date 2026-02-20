#!/usr/bin/env node
/**
 * check-encoding.cjs
 * Replaces the old check-encoding.js
 * Checks:
 *   1. Non-ASCII characters in any .ts/.tsx file
 *   2. Emoji artifact patterns (?? in string literals/JSX, ?* box drawing)
 *
 * Exit 0 = clean, Exit 1 = issues found
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? getAllFiles(path.join(dir, e.name)) :
    (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) ? [path.join(dir, e.name)] : []
  );
}

const files = getAllFiles(path.join(ROOT, 'src'));
let issues = [];

for (const f of files) {
  const rel = path.relative(ROOT, f);
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');

  // Check 1: non-ASCII
  let nonAscii = 0;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) > 127) nonAscii++;
  }
  if (nonAscii > 0) {
    issues.push(`[NON-ASCII] ${rel}: ${nonAscii} non-ASCII chars`);
  }

  // Check 2: emoji artifact patterns in non-comment lines
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    // Patterns that are always artifacts (not valid JS):
    // - "?? word" at start of string value (title/label/description)
    // - standalone "??" quoted
    // - >??< in JSX
    // - ?*? box drawing remnant
    if (
      /:\s*["'`]\?{2,}\s*\w/.test(line) ||  // key: "?? word"
      /["'`]\?{2,}["'`]/.test(line) ||       // "??" standalone
      />\?{2,}</.test(line) ||                // >??< JSX text
      /\?\*\?/.test(line)                     // ?*? box drawing
    ) {
      issues.push(`[ARTIFACT] ${rel}:${i + 1}: ${trimmed.substring(0, 100)}`);
    }
  });
}

if (issues.length === 0) {
  console.log('All files encoding clean.');
  process.exit(0);
} else {
  console.error('\nEncoding/artifact issues found:\n');
  issues.forEach(i => console.error('  ' + i));
  console.error('\nFix these before committing. Run: node scripts/verify.cjs');
  process.exit(1);
}
