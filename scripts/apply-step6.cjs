const fs = require('fs');
const path = require('path');
function read(rel) { return fs.readFileSync(path.join(__dirname,'..', rel),'utf8'); }
function write(rel, c) { fs.writeFileSync(path.join(__dirname,'..', rel), c,'utf8'); }

// ─── Fix 1: useDispatchData.ts -- type the map callbacks ─────────────────────
console.log('[1] useDispatchData.ts -- type map callbacks');
let ud = read('src/hooks/useDispatchData.ts');
ud = ud.replace(
  `            return [...new Set([\n                ...(data ?? []).map((d: any) => d.pickup_address),\n                ...(data ?? []).map((d: any) => d.delivery_address),`,
  `            type AddressRow = { pickup_address: string | null; delivery_address: string | null };\n            return [...new Set([\n                ...(data ?? []).map((d: AddressRow) => d.pickup_address),\n                ...(data ?? []).map((d: AddressRow) => d.delivery_address),`
);
write('src/hooks/useDispatchData.ts', ud);
console.log('  [OK] AddressRow type added');

// ─── Fix 2: useMessages.ts -- add error check to sendMessage ─────────────────
console.log('[2] useMessages.ts -- error check on insert');
let um = read('src/hooks/useMessages.ts');
um = um.replace(
  `      if (!loadId || !userId || !message.trim()) return;\n      await supabase.from('load_messages').insert({`,
  `      if (!loadId || !userId || !message.trim()) return;\n      const { error: msgErr } = await supabase.from('load_messages').insert({`
);
um = um.replace(
  `        read_by: [userId],\n      });`,
  `        read_by: [userId],\n      });\n      if (msgErr) throw new Error(msgErr.message);`
);
write('src/hooks/useMessages.ts', um);
console.log('  [OK] Error check added to sendMessage');

// ─── Verify ──────────────────────────────────────────────────────────────────
console.log('\n--- Verification ---');
const files = ['src/hooks/useDispatchData.ts', 'src/hooks/useMessages.ts'];
let allOk = true;
files.forEach(rel => {
  const c = read(rel);
  let enc = 0; for (let i=0;i<c.length;i++) if(c.charCodeAt(i)>127) enc++;
  const hasFix1 = rel.includes('useDispatchData') ? c.includes('AddressRow') : true;
  const hasFix2 = rel.includes('useMessages') ? c.includes('msgErr') : true;
  const ok = enc === 0 && hasFix1 && hasFix2;
  console.log((ok?'CLEAN':'ISSUE') + ' ' + rel.split('/').pop());
  if (!ok) allOk = false;
});
console.log(allOk ? 'All clean.' : 'Issues remain.');
