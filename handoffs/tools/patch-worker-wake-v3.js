'use strict';
// v3 on top of v2: "activity" must be evidence of a TURN, not any usage sample.
// Observed live 2026-09-07 (worker-holly): a zero-token usage sample stamped at
// session start read as "activity after the mail", so the stall rule stayed off
// and the watchdog logged `holding worker-holly: mid-turn (... last activity
// 63s ago)` while the worker had 0 tokens, no tool and no transcript.
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
if (!ROOT) throw new Error('usage: patch-worker-wake-v3.js <repo root>');
function patch(rel, edits) {
  const file = path.join(ROOT, rel);
  let src = fs.readFileSync(file, 'utf8');
  for (const [from, to] of edits) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`${rel}: anchor found ${n} times:\n${from.slice(0, 120)}`);
    src = src.replace(from, to);
  }
  fs.writeFileSync(file, src);
  console.log('patched', rel, `(${edits.length} edits)`);
}

patch('src/main/workerWake.ts', [
  [
`  return (f.lastActivityAt ?? 0) < mailAt;
}`,
`  return (f.lastActivityAt ?? 0) < mailAt;
}

/** The subset of telemetry the activity rule reads. Structural so the beat can
 *  hand it the collector's own types and tests can hand it literals. */
export interface ActivityEvidence {
  /** The agent's latest usage sample (cumulative counters, ts = last update). */
  usage?: { ts: number; input: number; output: number } | null;
  /** Tool spans the agent has run, in arrival order. */
  spans?: ReadonlyArray<{ ts: number }> | null;
}

/** When the CLI last demonstrably did a turn, or 0 when it never has.
 *
 *  A usage sample only counts when it carries tokens: the collector stamps a
 *  sample at session start with every counter at zero, and a boot-time sample
 *  is exactly what a worker that never took its first turn has. A tool span is
 *  always a turn. Observed live 2026-09-07: a worker with 0 tokens, no tool and
 *  no transcript read as "last activity 63s ago" and was held as mid-turn. */
export function activityEvidenceAt(ev: ActivityEvidence): number {
  const u = ev.usage;
  const worked = u && (Number(u.input) || 0) + (Number(u.output) || 0) > 0 ? Number(u.ts) || 0 : 0;
  let span = 0;
  for (const s of ev.spans ?? []) if (s && Number(s.ts) > span) span = Number(s.ts);
  return Math.max(worked, span);
}`
  ]
]);

patch('src/main/index.ts', [
  [
`import { WorkerWakeWatchdog, WORKER_WAKE_REPORT_MS, type WorkerWakeFacts } from './workerWake';`,
`import { WorkerWakeWatchdog, WORKER_WAKE_REPORT_MS, activityEvidenceAt, type WorkerWakeFacts } from './workerWake';`
  ],
  [
`      lastActivityAt: telemetry.getAgentUsage(agentId)?.ts ?? 0,`,
`      // A turn the CLI demonstrably took: a tool span, or a usage sample WITH
      // tokens. The zero-token sample stamped at session start is not one.
      lastActivityAt: activityEvidenceAt({ usage: telemetry.getAgentUsage(agentId), spans: telemetry.getSpans(agentId) }),`
  ]
]);

patch('test/worker-wake-stall.test.cjs', [
  [
`const {
  WorkerWakeWatchdog,
  isStalledWorker,`,
`const {
  WorkerWakeWatchdog,
  isStalledWorker,
  activityEvidenceAt,`
  ],
  [
`test('a stalled worker is nudged even though its terminal is chatty (the 17-minute case)', () => {`,
`test('activityEvidenceAt: only a turn counts — a zero-token sample at session start does not', () => {
  assert.equal(activityEvidenceAt({}), 0);
  assert.equal(activityEvidenceAt({ usage: null, spans: [] }), 0);
  assert.equal(activityEvidenceAt({ usage: { ts: 5_000, input: 0, output: 0 } }), 0, 'the boot-time sample');
  assert.equal(activityEvidenceAt({ usage: { ts: 5_000, input: 12, output: 0 } }), 5_000);
  assert.equal(activityEvidenceAt({ usage: { ts: 5_000, input: 0, output: 3 } }), 5_000);
  assert.equal(activityEvidenceAt({ usage: { ts: 5_000, input: 0, output: 0 }, spans: [{ ts: 7_000 }, { ts: 6_000 }] }), 7_000, 'a tool span is always a turn');
  assert.equal(activityEvidenceAt({ usage: { ts: 9_000, input: 1, output: 1 }, spans: [{ ts: 7_000 }] }), 9_000);
});

test('a worker whose only "activity" is the zero-token boot sample is stalled (the worker-holly case)', () => {
  const w = watchdog();
  const mailAt = NOW - 2 * 60_000;
  const bootSample = { ts: mailAt + 1_000, input: 0, output: 0 }; // stamped AFTER the mail
  const f = chatty({ oldestMailAt: mailAt, lastActivityAt: activityEvidenceAt({ usage: bootSample, spans: [] }) });
  assert.equal(f.lastActivityAt, 0);
  assert.equal(w.explain(f, NOW), null);
  assert.deepEqual(w.decide([f], NOW), ['stanley']);
});

test('a stalled worker is nudged even though its terminal is chatty (the 17-minute case)', () => {`
  ]
]);
console.log('done');
