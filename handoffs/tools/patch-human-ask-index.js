'use strict';
// The #454 hunk for src/main/index.ts only (the notifier wiring). Used when
// index.ts is taken wholesale from upstream during an integration merge.
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
if (!ROOT) throw new Error('usage: patch-human-ask-index.js <repo root>');
const file = path.join(ROOT, 'src/main/index.ts');
let src = fs.readFileSync(file, 'utf8');
const from = `// #7C — operator control state (pause/gate/steer/halt), read by the HookServer
// when deciding hook returns.
const control = new ControlRegistry();`;
const to = `// A new open ask for the human — whichever way it reached the ledger — gets a
// native toast, gated like every other toast on the notifications setting. The
// ASK ME tab/board are the durable surface; this only pulls the human back to
// them when they are not looking.
hive.setHumanAskNotifier((ask) => {
  if (!readConfig().notifications) return;
  try {
    if (!Notification.isSupported()) return;
    const reg = hive.registry();
    const who = resolveGodName(reg.agents[reg.godId ?? 'god']?.name);
    new Notification({ title: \`\${who} — ASK ME\`, body: ask.title }).show();
  } catch { /* best-effort */ }
});
// #7C — operator control state (pause/gate/steer/halt), read by the HookServer
// when deciding hook returns.
const control = new ControlRegistry();`;
const n = src.split(from).length - 1;
if (n !== 1) throw new Error(`anchor found ${n} times`);
if (src.includes('hive.setHumanAskNotifier(')) throw new Error('already applied');
fs.writeFileSync(file, src.replace(from, to));
console.log('patched index.ts (#454 notifier)');
