'use strict';
// Re-applies the worker-wake stall fix on top of upstream's edge-triggered
// watchdog (#358: same inbox ids are announced once). Exact-anchor patches;
// fails loudly if an anchor is missing or ambiguous.
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2] || '/Users/gastonpechieu/munder-difflin-pr-worker-wake';
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
function replaceBetween(rel, startAnchor, endAnchor, replacement) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  const s = src.indexOf(startAnchor);
  const e = src.indexOf(endAnchor, s);
  if (s < 0 || e < 0 || src.indexOf(startAnchor, s + 1) >= 0) throw new Error(`${rel}: range anchors not unique`);
  fs.writeFileSync(file, src.slice(0, s) + replacement + src.slice(e));
  console.log('replaced range in', rel);
}

// ── workerWake.ts ───────────────────────────────────────────────────────────
patch('src/main/workerWake.ts', [
  [
`export const WORKER_WAKE_HITL_REARM_MS = 5 * 60_000;`,
`export const WORKER_WAKE_HITL_REARM_MS = 5 * 60_000;
/** Mail this old with NO session activity since it landed = a STALLED worker:
 *  its CLI never took the first turn (a boot-time nudge lost while the TUI was
 *  still drawing, an occluded renderer that never typed one). PTY output cannot
 *  vouch for such a worker — a TUI redraws its chrome without doing any work,
 *  and the boot sequence itself is output — so past this age the quiet-output
 *  and never-output rules are bypassed, and so is the announced-ids edge trigger
 *  (#358 is for a worker that HEARD the announcement; a stalled one did not),
 *  still subject to paused/halted/HITL/boot-grace/cooldown. Observed live
 *  2026-09-06: a worker sat 17 minutes on its work order with 0 tokens and no
 *  transcript until the human typed "read your inbox" by hand; this watchdog
 *  never fired. */
export const WORKER_WAKE_STALL_MS = 90_000;
/** Minimum age of pending mail before a held worker is reported in the log. */
export const WORKER_WAKE_REPORT_MS = 60_000;`
  ],
  [
`  halted: boolean;
}`,
`  halted: boolean;
  /** Timestamp of the agent's last telemetry usage sample — the CLI's own
   *  evidence of a turn — or 0/undefined when it has never reported one. */
  lastActivityAt?: number;
  /** created_at of the OLDEST undrained inbox message, or 0/undefined when
   *  unknown (the stall rule then stays off — fail closed, as before). */
  oldestMailAt?: number;
}

/** Why a worker with pending mail is NOT being nudged right now. */
export type WorkerWakeHold =
  | 'god' | 'no-mail' | 'no-pty'
  | 'delivery-paused' | 'paused' | 'halted'
  | 'booting' | 'mid-turn' | 'boot-grace' | 'hitl' | 'announced' | 'cooldown';

/** The inbox ids that count as mail: non-empty strings only. */
function liveInboxIds(f: WorkerWakeFacts): Set<string> {
  return new Set(f.inboxIds.filter((id) => typeof id === 'string' && id.length > 0));
}

/** Mail has waited WORKER_WAKE_STALL_MS and the CLI has shown no session
 *  activity since it landed: whatever its terminal is printing, this worker is
 *  not working the mail. */
export function isStalledWorker(f: WorkerWakeFacts, now = Date.now()): boolean {
  const mailAt = f.oldestMailAt ?? 0;
  if (mailAt <= 0 || liveInboxIds(f).size === 0) return false;
  if (now - mailAt < WORKER_WAKE_STALL_MS) return false;
  return (f.lastActivityAt ?? 0) < mailAt;
}`
  ],
  [
`    this.announcedInboxIds.delete(agentId);
    this.lastHumanNeedsAt.delete(agentId);`,
`    this.announcedInboxIds.delete(agentId);
    this.lastHumanNeedsAt.delete(agentId);
    this.lastHoldReportAt.delete(agentId);`
  ]
]);

replaceBetween(
  'src/main/workerWake.ts',
  `  decide(facts: readonly WorkerWakeFacts[], now = Date.now()): string[] {`,
  `  lastNudge(agentId: string): number {`,
`  /** Why this worker is held right now, or null when it should be nudged.
   *  The same checks decide() applies, in the same order, exposed so the beat
   *  can LOG why a worker with old pending mail is not being woken — the
   *  watchdog's silence used to be indistinguishable from "nothing to do".
   *  Pure: never touches the announcement / cooldown memory. */
  explain(f: WorkerWakeFacts, now = Date.now()): WorkerWakeHold | null {
    const inboxIds = liveInboxIds(f);
    if (inboxIds.size === 0) return 'no-mail';
    if (f.isGod) return 'god';
    if (!f.ptyId) return 'no-pty';
    if (f.autoDeliveryPaused) return 'delivery-paused';
    if (f.paused) return 'paused';
    if (f.halted) return 'halted';
    const stalled = isStalledWorker(f, now);
    if (f.lastOutputAt <= 0 && !stalled) return 'booting'; // never produced output → still booting
    if (now - f.lastOutputAt < WORKER_WAKE_IDLE_MS && !stalled) return 'mid-turn';
    const spawned = this.spawnedAt.get(f.ptyId) ?? 0;
    if (spawned > 0 && now - spawned < WORKER_WAKE_BOOT_GRACE_MS) return 'boot-grace';
    const lastHuman = this.lastHumanNeedsAt.get(f.agentId) ?? 0;
    if (lastHuman > 0 && now - lastHuman < WORKER_WAKE_HITL_REARM_MS) return 'hitl';
    // Edge trigger (#358): mail already announced is not announced again — unless
    // the worker is stalled, i.e. it demonstrably never acted on the announcement.
    const announced = this.announcedInboxIds.get(f.agentId);
    if (announced && !stalled && !Array.from(inboxIds).some((id) => !announced.has(id))) return 'announced';
    const lastNudge = this.lastNudgeAt.get(f.agentId) ?? 0;
    if (lastNudge > 0 && now - lastNudge < WORKER_WAKE_COOLDOWN_MS) return 'cooldown';
    return null;
  }

  decide(facts: readonly WorkerWakeFacts[], now = Date.now()): string[] {
    const out: string[] = [];
    for (const f of facts) {
      const inboxIds = liveInboxIds(f);
      if (inboxIds.size === 0) {
        this.announcedInboxIds.delete(f.agentId);
        continue;
      }
      if (this.explain(f, now) !== null) continue;
      this.lastNudgeAt.set(f.agentId, now);
      this.announcedInboxIds.set(f.agentId, inboxIds);
      out.push(f.agentId);
    }
    return out;
  }

  /** agentId → when its hold was last reported, so the beat logs a held worker
   *  once per cooldown instead of every 15 s. */
  private lastHoldReportAt = new Map<string, number>();

  /** True once per WORKER_WAKE_COOLDOWN_MS per worker — the beat's log gate. */
  shouldReportHold(agentId: string, now = Date.now()): boolean {
    const last = this.lastHoldReportAt.get(agentId) ?? 0;
    if (last > 0 && now - last < WORKER_WAKE_COOLDOWN_MS) return false;
    this.lastHoldReportAt.set(agentId, now);
    return true;
  }

`
);

// ── index.ts ────────────────────────────────────────────────────────────────
patch('src/main/index.ts', [
  [
`import { WorkerWakeWatchdog, type WorkerWakeFacts } from './workerWake';`,
`import { WorkerWakeWatchdog, WORKER_WAKE_REPORT_MS, type WorkerWakeFacts } from './workerWake';`
  ],
  [
`    const ptyId = ptyForAgent(agentId);
    if (!ptyId) continue;
    const snap = control.snapshot(agentId);
    facts.push({
      agentId,
      isGod: agentId === reg.godId,
      ptyId,
      lastOutputAt: ptyManager.lastOutputAt(ptyId) ?? 0,
      inboxIds: hive.inbox(agentId).map((message) => message.id).filter(Boolean),
      autoDeliveryPaused: snap.autoDeliveryPaused,
      paused: snap.paused,
      halted: snap.halted
    });
  }
  for (const agentId of workerWake.decide(facts, now)) {
    const ptyId = ptyForAgent(agentId);
    if (!ptyId) continue;
    // Re-read at delivery time, not from the facts snapshot: the agent may have
    // drained the mail during the beat, and a nudge naming ids it already filed
    // is the exact staleness #187 exists to stop.
    const ids = hive.inbox(agentId).map((m) => m.id).filter(Boolean);
    if (!ids.length) { console.log(\`[worker-wake] \${agentId} drained before delivery, skipping\`); continue; }
    console.log(\`[worker-wake] nudging \${agentId} on \${ptyId} (\${ids.length} pending)\`);
    nudgeWorker(ptyId, ids);
  }
}`,
`    const ptyId = ptyForAgent(agentId);
    if (!ptyId) continue;
    const snap = control.snapshot(agentId);
    const mail = hive.inbox(agentId);
    // Oldest pending message: the stall rule measures how long the worker has
    // ignored its mail, and telemetry says whether it has done ANY turn since.
    let oldestMailAt = 0;
    for (const m of mail) {
      const t = Date.parse(m.created_at ?? '');
      if (Number.isFinite(t) && (oldestMailAt === 0 || t < oldestMailAt)) oldestMailAt = t;
    }
    facts.push({
      agentId,
      isGod: agentId === reg.godId,
      ptyId,
      lastOutputAt: ptyManager.lastOutputAt(ptyId) ?? 0,
      inboxIds: mail.map((message) => message.id).filter(Boolean),
      autoDeliveryPaused: snap.autoDeliveryPaused,
      paused: snap.paused,
      halted: snap.halted,
      lastActivityAt: telemetry.getAgentUsage(agentId)?.ts ?? 0,
      oldestMailAt
    });
  }
  const nudged = new Set(workerWake.decide(facts, now));
  for (const agentId of nudged) {
    const ptyId = ptyForAgent(agentId);
    if (!ptyId) continue;
    // Re-read at delivery time, not from the facts snapshot: the agent may have
    // drained the mail during the beat, and a nudge naming ids it already filed
    // is the exact staleness #187 exists to stop.
    const ids = hive.inbox(agentId).map((m) => m.id).filter(Boolean);
    if (!ids.length) { console.log(\`[worker-wake] \${agentId} drained before delivery, skipping\`); continue; }
    console.log(\`[worker-wake] nudging \${agentId} on \${ptyId} (\${ids.length} pending)\`);
    nudgeWorker(ptyId, ids);
  }
  // A worker sitting on old mail without a nudge is the failure this watchdog
  // exists for — say WHY it is being held, once per cooldown, so the log can
  // never again read "nothing happened" while a worker starves on its inbox.
  for (const f of facts) {
    if (nudged.has(f.agentId) || f.inboxIds.length === 0) continue;
    const mailAge = f.oldestMailAt && f.oldestMailAt > 0 ? now - f.oldestMailAt : 0;
    if (mailAge < WORKER_WAKE_REPORT_MS) continue;
    if (!workerWake.shouldReportHold(f.agentId, now)) continue;
    const hold = workerWake.explain(f, now);
    const quiet = f.lastOutputAt > 0 ? \`\${Math.round((now - f.lastOutputAt) / 1000)}s\` : 'never';
    const active = f.lastActivityAt && f.lastActivityAt > 0 ? \`\${Math.round((now - f.lastActivityAt) / 1000)}s ago\` : 'never';
    console.warn(\`[worker-wake] holding \${f.agentId}: \${hold} (mail pending \${Math.round(mailAge / 1000)}s, pty quiet \${quiet}, last activity \${active})\`);
  }
}`
  ]
]);
console.log('done');
