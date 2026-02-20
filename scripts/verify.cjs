#!/usr/bin/env node
/**
 * verify.cjs -- Anika Codebase Verifier
 * ----------------------------------------
 * Runs after every coding agent task.
 * Usage: node scripts/verify.cjs [optional: file1.tsx file2.tsx ...]
 *
 * If specific files are passed, focuses report on those.
 * If no files passed, scans entire src/.
 *
 * Exit code 0 = PASS, 1 = FAIL
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const focusFiles = args.length > 0 ? args.map(f => path.resolve(ROOT, f)) : null;

let passed = 0;
let failed = 0;
const failures = [];

function pass(label) {
  console.log('  [PASS] ' + label);
  passed++;
}
function fail(label, detail) {
  console.log('  [FAIL] ' + label);
  if (detail) console.log('         ' + detail);
  failed++;
  failures.push({ label, detail });
}
function section(title) {
  const pad = Math.max(2, 50 - title.length);
  console.log('\n-- ' + title + ' ' + '-'.repeat(pad));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAllFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? getAllFiles(path.join(dir, e.name)) :
    (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) ? [path.join(dir, e.name)] : []
  );
}

function getFilesToScan() {
  if (focusFiles) return focusFiles.filter(f => fs.existsSync(f));
  return getAllFiles(path.join(ROOT, 'src'));
}

// ─── CHECK 1: TypeScript ──────────────────────────────────────────────────────
section('1. TypeScript');
try {
  const out = execSync('npx tsc --noEmit 2>&1', { cwd: ROOT, encoding: 'utf8' });
  if (out.trim() === '') {
    pass('tsc --noEmit: 0 errors');
  } else {
    const errorLines = out.trim().split('\n').slice(0, 5);
    fail('tsc --noEmit: errors found', errorLines.join(' | '));
  }
} catch (e) {
  const out = (e.stdout || '') + (e.stderr || '');
  const errorLines = out.trim().split('\n').slice(0, 5);
  fail('tsc --noEmit: errors found', errorLines.join(' | '));
}

// ─── CHECK 2: Encoding ───────────────────────────────────────────────────────
section('2. Encoding (non-ASCII chars)');
const files = getFilesToScan();
let encDirty = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  let bad = 0;
  for (let i = 0; i < c.length; i++) if (c.charCodeAt(i) > 127) bad++;
  if (bad > 0) encDirty.push(path.relative(ROOT, f) + ' (' + bad + ' chars)');
}
if (encDirty.length === 0) {
  pass('No non-ASCII characters in ' + files.length + ' files');
} else {
  fail('Non-ASCII chars found in ' + encDirty.length + ' files', encDirty.slice(0, 5).join(' | '));
}

// ─── CHECK 3: Emoji artifacts ────────────────────────────────────────────────
section('3. Emoji artifacts (?? patterns in strings/JSX)');
let artifactFiles = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  const hits = [];
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    // Look for genuine emoji artifact patterns ONLY.
    // Artifacts are replaced emojis that look like: "?? New Load!", title: "?? Blast!"
    // Rule: a standalone quoted string that is ONLY ?? chars (no JS variable interpolation around them)
    const isArtifact =
      /:\s*["'`]\?{2,}\s*\w/.test(line) ||        // key: "?? word"  (label/title/icon assignments)
      /["'`]\?{2,}["'`]/.test(line) ||             // "??" standalone
      />\?{2,}</.test(line) ||                     // >??< in JSX
      /\?\*\?/.test(line);                         // ?*? box drawing artifact

    if (isArtifact) {
      hits.push('L' + (i + 1) + ': ' + trimmed.substring(0, 80));
    }
  });
  if (hits.length > 0) artifactFiles.push({ file: path.relative(ROOT, f), hits });
}
if (artifactFiles.length === 0) {
  pass('No emoji artifacts found');
} else {
  const summary = artifactFiles.map(a => a.file + ' (' + a.hits.length + ' hits)').join(' | ');
  fail('Emoji artifacts found in ' + artifactFiles.length + ' files', summary);
  artifactFiles.slice(0, 3).forEach(a => {
    a.hits.slice(0, 2).forEach(h => console.log('         ' + a.file + ' ' + h));
  });
}

// ─── CHECK 4: ErrorBoundary coverage ─────────────────────────────────────────
section('4. ErrorBoundary coverage (pages)');
const pageFiles = getAllFiles(path.join(ROOT, 'src', 'pages'));
let missingEB = [];
for (const f of pageFiles) {
  if (!f.endsWith('.tsx')) continue;         // skip .ts type files
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n').length;
  if (lines < 30) continue;                  // tiny static pages exempt
  if (f.includes('NotFound')) continue;      // static 404 page exempt
  if (!c.includes('export default')) continue; // not a page component
  if (!c.includes('<ErrorBoundary>')) {
    missingEB.push(path.relative(ROOT, f) + ' (' + lines + 'L)');
  }
}
if (missingEB.length === 0) {
  pass('All pages have ErrorBoundary');
} else {
  fail(missingEB.length + ' pages missing ErrorBoundary', missingEB.join(' | '));
}

// ─── CHECK 5: Empty catch blocks ─────────────────────────────────────────────
section('5. Empty catch blocks');
let emptyCatchFiles = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const matches = c.match(/catch\s*\(\s*\)\s*\{[\s\n]*\}/g) || [];
  if (matches.length > 0) {
    emptyCatchFiles.push(path.relative(ROOT, f) + ' (' + matches.length + 'x)');
  }
}
if (emptyCatchFiles.length === 0) {
  pass('No empty catch blocks');
} else {
  fail('Empty catch blocks in ' + emptyCatchFiles.length + ' files', emptyCatchFiles.join(' | '));
}

// ─── CHECK 6: console.log in production code ─────────────────────────────────
section('6. console.log statements');
let consoleFiles = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const count = (c.match(/console\.log\(/g) || []).length;
  if (count > 0) consoleFiles.push(path.relative(ROOT, f) + ' (' + count + 'x)');
}
if (consoleFiles.length === 0) {
  pass('No console.log statements');
} else {
  // Warn but don't fail -- console.log is not critical
  console.log('  [WARN] console.log in ' + consoleFiles.length + ' files: ' + consoleFiles.slice(0, 3).join(', '));
}

// ─── CHECK 7: Unguarded Supabase mutations ────────────────────────────────────
section('7. Unguarded Supabase mutations (insert/update/delete without error check)');
let unguarded = [];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  lines.forEach((line, i) => {
    if (/^\s*await supabase\.from\(/.test(line) &&
        /\.(insert|update|delete)\(/.test(line)) {
      // Check surrounding lines (within 3 lines) for error handling
      const context = lines.slice(Math.max(0, i - 1), i + 4).join('\n');
      if (!/if\s*\(\s*(error|err)\b/.test(context) &&
          !/const\s*\{[^}]*error/.test(context) &&
          !context.includes('throw') &&
          !context.includes('.catch(')) {
        unguarded.push(path.relative(ROOT, f) + ':L' + (i + 1));
      }
    }
  });
}
if (unguarded.length === 0) {
  pass('All Supabase mutations have error handling');
} else {
  console.log('  [WARN] ' + unguarded.length + ' possibly unguarded mutations (review manually): ' + unguarded.slice(0, 5).join(', '));
}

// ─── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(60));
console.log('VERIFICATION RESULT: ' + (failed === 0 ? 'PASS' : 'FAIL'));
console.log('Checks passed: ' + passed + ' | Failed: ' + failed);
if (failures.length > 0) {
  console.log('\nFailed checks:');
  failures.forEach(f => console.log('  - ' + f.label));
}
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
