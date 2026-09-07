'use strict';
// Delivery with confirmation: a queued message is acknowledged only once the
// agent's CLI reports the prompt submit (UserPromptSubmit hook), not when the
// PTY took the bytes. Exact-anchor patches; fails loudly on drift.
const fs = require('fs');
const path = require('path');
const ROOT = process.argv[2];
if (!ROOT) throw new Error('usage: patch-prompt-ack.js <repo root>');
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

// ── queueDelivery.ts: append the confirmation primitives ────────────────────
{
  const file = path.join(ROOT, 'src/renderer/src/hooks/queueDelivery.ts');
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('PromptAckTracker')) throw new Error('queueDelivery.ts already patched');
  src = src.replace(/\s*$/, '\n') + `
/** The hook event that proves a typed prompt reached the agent's CLI, per
 *  provider — or null when the provider gives no such signal (delivery is then
 *  acknowledged on the PTY write, as before). Claude Code, Codex and Gemini all
 *  run the harness shim on UserPromptSubmit (see installClaudeHooks /
 *  installCodexHooks / the Gemini BeforeAgent mapping in hive.ts). */
export function promptAckEventFor(provider: string): 'UserPromptSubmit' | null {
  return provider === 'claude' || provider === 'codex' || provider === 'gemini' ? 'UserPromptSubmit' : null;
}

/** Slash commands (/compact, /clear, /remote-control …) are handled by the TUI
 *  itself and do not reliably raise UserPromptSubmit, so they keep the
 *  write-is-delivery rule: demanding a confirmation would re-type /compact. */
export function promptNeedsConfirmation(provider: string, text: string): boolean {
  return promptAckEventFor(provider) !== null && !text.trim().startsWith('/');
}

/** Per-agent memory of prompt-submit events, so a delivery can wait for the
 *  one that proves ITS prompt was received.
 *
 *  Why: "ready to receive" is judged by the TUI having painted anything plus a
 *  short settle (providerAutomation.terminalReadyToReceive), which is the boot
 *  banner, not the input box. Bytes typed before the CLI's input handler is
 *  attached are silently lost, and the old acknowledge-on-write rule then
 *  dropped the queue item, so nothing ever retried. Observed live twice
 *  (2026-09-06 worker-stanley4, 2026-09-07 worker-holly): work order in the
 *  inbox, queue empty, 0 tokens, no transcript, for as long as nobody typed
 *  by hand. Pure and clock-injectable so it is unit-testable. */
export class PromptAckTracker {
  private lastAt = new Map<string, number>();
  private waiters = new Map<string, Array<{ since: number; resolve: (ok: boolean) => void }>>();

  /** Record a prompt submit reported by \`agentId\` at \`at\`. Wakes every waiter
   *  whose typing happened at or before that moment. */
  note(agentId: string, at = Date.now()): void {
    const prev = this.lastAt.get(agentId) ?? 0;
    if (at > prev) this.lastAt.set(agentId, at);
    const list = this.waiters.get(agentId);
    if (!list) return;
    const keep: typeof list = [];
    for (const w of list) {
      if (w.since <= at) w.resolve(true); else keep.push(w);
    }
    if (keep.length) this.waiters.set(agentId, keep); else this.waiters.delete(agentId);
  }

  /** Resolves true once a prompt submit at or after \`since\` is known for
   *  \`agentId\`; false when \`timeoutMs\` elapses first. A submit that already
   *  happened resolves immediately. */
  waitFor(agentId: string, since: number, timeoutMs: number): Promise<boolean> {
    const last = this.lastAt.get(agentId) ?? 0;
    if (last >= since) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const w = { since, resolve: (ok: boolean) => { clearTimeout(timer); resolve(ok); } };
      const timer = setTimeout(() => {
        const list = this.waiters.get(agentId) ?? [];
        const rest = list.filter((x) => x !== w);
        if (rest.length) this.waiters.set(agentId, rest); else this.waiters.delete(agentId);
        resolve(false);
      }, timeoutMs);
      const list = this.waiters.get(agentId) ?? [];
      list.push(w);
      this.waiters.set(agentId, list);
    });
  }

  /** Drop everything known about an agent (it exited / was archived). */
  forget(agentId: string): void {
    this.lastAt.delete(agentId);
    for (const w of this.waiters.get(agentId) ?? []) w.resolve(false);
    this.waiters.delete(agentId);
  }
}

export type DeliveryOutcome = 'delivered' | 'unconfirmed' | 'failed';

/** Run one queued delivery: send, then wait for the agent's own confirmation,
 *  and acknowledge only then. \`unconfirmed\` = the PTY took the bytes but the
 *  CLI never reported the prompt — the caller keeps the item and retries.
 *  \`failed\` = the send itself rejected (dead PTY), as before. */
export async function deliverWithConfirmation(
  send: () => Promise<void>,
  confirm: () => Promise<boolean>,
  acknowledge: () => void
): Promise<DeliveryOutcome> {
  try {
    await send();
  } catch {
    return 'failed';
  }
  if (!(await confirm())) return 'unconfirmed';
  acknowledge();
  return 'delivered';
}
`;
  fs.writeFileSync(file, src);
  console.log('patched src/renderer/src/hooks/queueDelivery.ts (append)');
}

// ── useHive.ts ──────────────────────────────────────────────────────────────
patch('src/renderer/src/hooks/useHive.ts', [
  [
`import { canDeliverToAgent, deliverWithAcknowledgement, checkPrecondition } from './queueDelivery';`,
`import {
  canDeliverToAgent, deliverWithConfirmation, checkPrecondition,
  PromptAckTracker, promptNeedsConfirmation
} from './queueDelivery';`
  ],
  [
`const writeChains = new Map<string, Promise<void>>();`,
`const writeChains = new Map<string, Promise<void>>();
/** Prompt submits reported by each agent's hooks — the proof a typed message
 *  actually reached its CLI (see PromptAckTracker). Module-level like the write
 *  chains: one per renderer, shared by the hook listener and the queue drain. */
const promptAck = new PromptAckTracker();
/** How long a delivery waits for the agent's UserPromptSubmit before it is
 *  retried. Hooks cold-start in ~1 s; a TUI that is still booting can take
 *  several seconds to attach its input handler — that is exactly the window
 *  in which typed bytes were being lost. */
const PROMPT_ACK_TIMEOUT_MS = 10_000;
/** After this many unconfirmed attempts the message is acknowledged on the PTY
 *  write like before (and the console says so): a CLI whose hooks are broken
 *  must not be re-typed into forever. The main-process worker-wake watchdog
 *  still re-nudges a worker that demonstrably never took a turn. */
const MAX_ACK_MISSES = 3;`
  ],
  [
`    return window.cth.onHiveHookEvent((e) => {
      if (!e.agentId) return;
      const { updateAgent, agents } = useStore.getState();`,
`    return window.cth.onHiveHookEvent((e) => {
      if (!e.agentId) return;
      // The CLI's own receipt for a typed prompt — what the queue drain waits
      // for before it acknowledges a delivery.
      if (e.event === 'UserPromptSubmit') promptAck.note(e.agentId);
      const { updateAgent, agents } = useStore.getState();`
  ],
  [
`    const MAX_SEND_ATTEMPTS = 3;
    const inFlight = new Set<string>();
    const sendFailures: Record<string, number> = {};`,
`    const MAX_SEND_ATTEMPTS = 3;
    const inFlight = new Set<string>();
    const sendFailures: Record<string, number> = {};
    // Deliveries the PTY accepted but the CLI never confirmed (no
    // UserPromptSubmit): retried, bounded by MAX_ACK_MISSES.
    const ackMisses: Record<string, number> = {};`
  ],
  [
`      lastFlush.current[target.id] = now;
      try {
        const sent = await deliverWithAcknowledgement(
          // \`instruction\` (when present) is the authoritative text to type into
          // the PTY; UI/card surfaces continue to show the readable \`text\`.
          () => submitToPty(
            target.ptyId!,
            withStandingGoal(
              target,
              wrap ? wrap(next) : (next.instruction ?? next.text)
            ),
            inferAgentProvider(target.command, target.provider)
          ),
          () => {`,
`      lastFlush.current[target.id] = now;
      try {
        const provider = inferAgentProvider(target.command, target.provider);
        // \`instruction\` (when present) is the authoritative text to type into
        // the PTY; UI/card surfaces continue to show the readable \`text\`.
        const typed = withStandingGoal(target, wrap ? wrap(next) : (next.instruction ?? next.text));
        // A message is delivered when the agent's CLI says it received it, not
        // when the PTY took the bytes: a TUI still booting swallows keystrokes,
        // and acknowledging on the write dropped the queue item with nothing to
        // retry (worker-stanley4 2026-09-06, worker-holly 2026-09-07: work order
        // in the inbox, queue empty, 0 tokens, until a human typed by hand).
        // Providers without a prompt hook, and slash commands, keep the old rule.
        const confirmable = promptNeedsConfirmation(provider, typed)
          && (ackMisses[next.id] ?? 0) < MAX_ACK_MISSES;
        const typedAt = Date.now();
        const outcome = await deliverWithConfirmation(
          () => submitToPty(target.ptyId!, typed, provider),
          () => (confirmable ? promptAck.waitFor(target.id, typedAt, PROMPT_ACK_TIMEOUT_MS) : Promise.resolve(true)),
          () => {`
  ],
  [
`        if (sent) {
          delete sendFailures[next.id];
          return { sent: true, message: next };
        }
        // Failed write (dead/crashed pty the store still thinks is idle): retry`,
`        if (outcome === 'delivered') {
          if ((ackMisses[next.id] ?? 0) >= MAX_ACK_MISSES) {
            console.warn(
              \`[queue-drain] \${target.id} never reported UserPromptSubmit for message \${next.id} after \` +
              \`\${MAX_ACK_MISSES} attempts — acknowledged on the PTY write; check its hooks\`
            );
          }
          delete sendFailures[next.id];
          delete ackMisses[next.id];
          return { sent: true, message: next };
        }
        if (outcome === 'unconfirmed') {
          const misses = (ackMisses[next.id] ?? 0) + 1;
          ackMisses[next.id] = misses;
          console.warn(
            \`[queue-drain] \${target.id} did not report UserPromptSubmit within \${PROMPT_ACK_TIMEOUT_MS}ms \` +
            \`for message \${next.id} (attempt \${misses}/\${MAX_ACK_MISSES}) — keeping it queued for retry\`
          );
          return { sent: false };
        }
        // Failed write (dead/crashed pty the store still thinks is idle): retry`
  ]
]);
console.log('done');
