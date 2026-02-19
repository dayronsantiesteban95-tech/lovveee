#!/usr/bin/env node
/**
 * Anika Code Review Script — CI Edition
 * Runs inside the repo (GitHub Actions compatible).
 * Analyzes the latest git diff for quality issues.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO_ROOT, 'src');

function run(cmd) {
  try {
    return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf8' }).toString().trim();
  } catch (e) {
    return ((e.stdout || '') + (e.stderr || '')).trim();
  }
}

function countLines(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split('\n').length;
  } catch { return 0; }
}

function walkSrc(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkSrc(full, results);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) results.push(full);
  }
  return results;
}

// ─── Commit info ──────────────────────────────────────────────────────────────
const latestHash = run('git rev-parse --short HEAD') || 'unknown';
const latestMessage = run('git log -1 --format=%s') || 'unknown';

// ─── Diff ─────────────────────────────────────────────────────────────────────
let diff = run('git diff HEAD~1 HEAD --unified=0');
if (!diff) diff = run('git show HEAD --unified=0');

const diffLines = diff.split('\n');
let currentFile = '';
let currentLineNum = 0;
const addedLinesByFile = {};

for (const line of diffLines) {
  if (line.startsWith('+++ b/')) {
    currentFile = line.slice(6).trim();
    if (!addedLinesByFile[currentFile]) addedLinesByFile[currentFile] = [];
    continue;
  }
  if (line.startsWith('--- ') || line.startsWith('+++ ')) continue;
  if (line.startsWith('@@ ')) {
    const m = line.match(/@@ [^+]*\+(\d+)/);
    if (m) currentLineNum = parseInt(m[1], 10);
    continue;
  }
  if (line.startsWith('+')) {
    if (currentFile) addedLinesByFile[currentFile].push({ lineNum: currentLineNum, content: line.slice(1) });
    currentLineNum++;
  } else if (!line.startsWith('-')) {
    currentLineNum++;
  }
}

// ─── Checks ───────────────────────────────────────────────────────────────────
const srcFiles = walkSrc(SRC_DIR);

// 1. Encoding
const encodingIssues = [];
for (const [file, lines] of Object.entries(addedLinesByFile)) {
  for (const { lineNum, content } of lines) {
    if (/[^\x00-\x7F]/.test(content)) encodingIssues.push(`${file}:${lineNum}`);
  }
}

// 2. console.log
const consoleLogs = [];
for (const filePath of srcFiles) {
  try {
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*\/\//.test(line)) return;
      if (/console\.log\s*\(/.test(line)) {
        consoleLogs.push(`${path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')}:${i + 1}`);
      }
    });
  } catch {}
}

// 3. Null checks
const nullCheckIssues = [];
for (const [file, lines] of Object.entries(addedLinesByFile)) {
  for (const { lineNum, content } of lines) {
    if (/\w\.data\.\w/.test(content) && !/\?\.\s*data\?\./.test(content)) {
      nullCheckIssues.push(`${file}:${lineNum}`);
    }
  }
}

// 4. Secrets
const secretPatterns = [
  { pattern: /\bsk_[a-zA-Z0-9_\-]{10,}/, label: 'sk_ key' },
  { pattern: /\bpk_[a-zA-Z0-9_\-]{10,}/, label: 'pk_ key' },
  { pattern: /eyJ[a-zA-Z0-9_\-]{20,}/, label: 'JWT token' },
  { pattern: /\bAIza[a-zA-Z0-9_\-]{30,}/, label: 'Google API key' },
  { pattern: /password\s*[:=]\s*['"][^'"]{6,}['"]/, label: 'Hardcoded password' },
];
const secretsFound = [];
for (const [file, lines] of Object.entries(addedLinesByFile)) {
  if (/\.env/.test(file) || /\.d\.ts$/.test(file)) continue;
  for (const { lineNum, content } of lines) {
    if (/^\s*\/\//.test(content)) continue;
    for (const { pattern, label } of secretPatterns) {
      if (pattern.test(content)) { secretsFound.push(`${file}:${lineNum} [${label}]`); break; }
    }
  }
}

// 5. TODOs
const todos = [];
for (const filePath of srcFiles) {
  try {
    fs.readFileSync(filePath, 'utf8').split('\n').forEach((line, i) => {
      if (/\b(TODO|FIXME|HACK|XXX)\b/i.test(line)) {
        todos.push(`${path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')}:${i + 1}`);
      }
    });
  } catch {}
}

// 6. Large files
const largeFiles = [];
for (const filePath of srcFiles) {
  const lines = countLines(filePath);
  if (lines > 500) largeFiles.push(`${path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')} (${lines} lines)`);
}

// 7. Empty catch blocks
const emptyCatches = [];
for (const filePath of srcFiles) {
  try {
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(fs.readFileSync(filePath, 'utf8'))) {
      emptyCatches.push(path.relative(REPO_ROOT, filePath).replace(/\\/g, '/'));
    }
  } catch {}
}

// ─── Report ───────────────────────────────────────────────────────────────────
const hasCritical = secretsFound.length > 0 || encodingIssues.length > 0;
const hasWarnings = hasCritical || consoleLogs.length > 0 || nullCheckIssues.length > 0 || largeFiles.length > 0 || emptyCatches.length > 0;
const overall = hasCritical ? '🚨 CRITICAL — review required' : hasWarnings ? '⚠️ GOOD — minor warnings' : '✅ EXCELLENT — no issues';

console.log('='.repeat(60));
console.log('🔍 ANIKA CODE REVIEW');
console.log(`Latest commit: ${latestHash} — ${latestMessage}`);
console.log('='.repeat(60));
console.log(encodingIssues.length === 0 ? '✅ Encoding: Clean' : `🚨 Encoding issues: ${encodingIssues.length}`);
if (encodingIssues.length) encodingIssues.slice(0, 5).forEach(i => console.log(`   ${i}`));

console.log(consoleLogs.length === 0 ? '✅ console.log: None' : `⚠️ console.log: ${consoleLogs.length} found`);
if (consoleLogs.length) consoleLogs.slice(0, 5).forEach(i => console.log(`   ${i}`));

console.log(secretsFound.length === 0 ? '✅ No hardcoded secrets' : `🚨 SECRETS FOUND: ${secretsFound.length}`);
if (secretsFound.length) secretsFound.forEach(i => console.log(`   ${i}`));

console.log(`📝 TODOs: ${todos.length}`);
console.log(largeFiles.length === 0 ? '✅ File sizes: OK' : `⚠️ Large files: ${largeFiles.length}`);
if (largeFiles.length) largeFiles.forEach(i => console.log(`   ${i}`));

console.log(emptyCatches.length === 0 ? '✅ Error handling: OK' : `⚠️ Empty catches: ${emptyCatches.length}`);
console.log('='.repeat(60));
console.log(`Overall: ${overall}`);
console.log('='.repeat(60));

// Exit with error code if critical issues found
if (hasCritical) process.exit(1);
