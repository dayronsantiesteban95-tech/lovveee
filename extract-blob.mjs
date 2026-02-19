/**
 * Extract the raw git blob and analyze/fix encoding
 */
import { execSync, spawnSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoDir = __dirname;

// Get the blob hash
const lsFiles = execSync('git ls-files -s -- src/pages/DispatchTracker.tsx', {
  cwd: repoDir, encoding: 'buffer'
});
const blobHash = lsFiles.toString().split(/\s+/)[1];
console.log('Blob hash:', blobHash);

// Get raw blob bytes using git cat-file with binary output
const result = spawnSync('git', ['cat-file', 'blob', blobHash], {
  cwd: repoDir,
  encoding: null, // raw buffer
  maxBuffer: 10 * 1024 * 1024
});

if (result.error) {
  console.error('Error:', result.error);
  process.exit(1);
}

const blobBytes = result.stdout;
console.log(`Blob size: ${blobBytes.length} bytes`);
console.log('First 30 bytes:', Array.from(blobBytes.slice(0,30)).map(b => b.toString(16).padStart(2,'0')).join(' '));

// Save the blob to a file
writeFileSync(join(repoDir, 'blob-original.bin'), blobBytes);
console.log('Saved blob to blob-original.bin');

// Analyze the blob encoding
let c3a2Count = 0, efbfbdCount = 0, e2xxCount = 0;
for (let i = 0; i < blobBytes.length; i++) {
  if (i+1 < blobBytes.length && blobBytes[i] === 0xC3 && blobBytes[i+1] === 0xA2) c3a2Count++;
  if (i+2 < blobBytes.length && blobBytes[i] === 0xEF && blobBytes[i+1] === 0xBF && blobBytes[i+2] === 0xBD) efbfbdCount++;
}
console.log(`C3A2 (double-encoded â) count: ${c3a2Count}`);
console.log(`FFFD (replacement char) count: ${efbfbdCount}`);

// Check if it has BOM
const hasBOM = blobBytes[0] === 0xEF && blobBytes[1] === 0xBB && blobBytes[2] === 0xBF;
console.log('Has BOM:', hasBOM);

// Show around DISPATCH TRACKER in the blob
const dtPattern = Buffer.from('DISPATCH');
for (let i = 0; i < blobBytes.length - 8; i++) {
  let match = true;
  for (let j = 0; j < 8; j++) {
    if (blobBytes[i+j] !== dtPattern[j]) { match = false; break; }
  }
  if (match) {
    const ctx = blobBytes.slice(Math.max(0,i-5), i+50);
    console.log('\nDISPATCH area in blob:');
    console.log('Hex:', Array.from(ctx).map(b => b.toString(16).padStart(2,'0')).join(' '));
    console.log('UTF8:', ctx.toString('utf8'));
    break;
  }
}
