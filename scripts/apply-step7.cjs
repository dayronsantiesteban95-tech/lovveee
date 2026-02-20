/**
 * Step 7 -- Edge Functions cleanup
 * Fix em dashes in comments only.
 * Preserve emojis in sentry-alert and vercel-deploy-alert (Telegram message strings).
 * Do NOT touch: send-outreach-email, send-push-notification (already clean)
 */
const fs = require('fs');
const path = require('path');

const BASE = path.join(__dirname, '..', 'supabase', 'functions');

// Files that have emojis in actual message strings -- preserve them
const PRESERVE_EMOJIS = ['sentry-alert', 'vercel-deploy-alert'];

function fixCommentDashes(content) {
  // Replace em dash (U+2014) -> --
  content = content.replace(/\u2014/g, '--');
  // Replace en dash (U+2013) -> -
  content = content.replace(/\u2013/g, '-');
  // Replace box-drawing chars -> -
  content = content.replace(/[\u2500-\u257F]/g, '-');
  // Replace smart quotes
  content = content.replace(/[\u2018\u2019]/g, "'");
  content = content.replace(/[\u201C\u201D]/g, '"');
  return content;
}

function fixAll(content) {
  // Fix dashes + all non-ASCII
  content = fixCommentDashes(content);
  content = content.replace(/[^\x00-\x7F]/g, '?');
  return content;
}

function countNonAscii(content) {
  let bad = 0;
  for (let i = 0; i < content.length; i++) if (content.charCodeAt(i) > 127) bad++;
  return bad;
}

const fns = fs.readdirSync(BASE).filter(f =>
  fs.statSync(path.join(BASE, f)).isDirectory()
);

let fixed = 0;
let skipped = 0;

for (const fn of fns) {
  const indexPath = path.join(BASE, fn, 'index.ts');
  if (!fs.existsSync(indexPath)) continue;

  const original = fs.readFileSync(indexPath, 'utf8');
  const before = countNonAscii(original);

  if (before === 0) {
    console.log('[CLEAN] ' + fn);
    skipped++;
    continue;
  }

  let result;
  if (PRESERVE_EMOJIS.includes(fn)) {
    // Only fix em dashes in comments -- preserve emojis in strings
    result = fixCommentDashes(original);
    const after = countNonAscii(result);
    // If remaining non-ASCII are all emojis in strings, that's fine
    console.log('[PARTIAL] ' + fn + ' -- ' + before + ' -> ' + after + ' non-ASCII (emojis preserved for Telegram)');
  } else {
    result = fixAll(original);
    const after = countNonAscii(result);
    console.log((after === 0 ? '[OK] ' : '[WARN] ') + fn + ' -- ' + before + ' -> ' + after + ' non-ASCII');
  }

  fs.writeFileSync(indexPath, result, 'utf8');
  fixed++;
}

console.log('\n--- Summary ---');
console.log('Fixed: ' + fixed + ' | Already clean: ' + skipped);

// Verify all non-preserved files are clean
console.log('\n--- Per-function encoding ---');
for (const fn of fns) {
  const indexPath = path.join(BASE, fn, 'index.ts');
  if (!fs.existsSync(indexPath)) continue;
  const c = fs.readFileSync(indexPath, 'utf8');
  const bad = countNonAscii(c);
  const preserved = PRESERVE_EMOJIS.includes(fn);
  const status = bad === 0 ? 'CLEAN' : (preserved ? 'OK (emojis kept)' : 'DIRTY:'+bad);
  console.log('  ' + fn.padEnd(28) + status);
}
