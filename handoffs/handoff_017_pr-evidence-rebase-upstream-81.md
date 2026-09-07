# HANDOFF 017 — PRs #454/#455 con evidencia y rebasados; upstream +81 commits integrado (FF pendiente) — 2026-09-07

## ESTADO INICIAL
- Branch/worktree: `feature/god-workers-visibles-roster-guard` @ `b3c15326` (handoff 016 + docs). App en `npm run dev` desde ese árbol, Michael + Kevin trabajando en `NETLINK_CyberSecurity`.
- Contexto relevante: el usuario pidió revisar si upstream aceptó los PRs y si estamos al día.

## CAMBIOS
- **PRs (fork → upstream):**
  - Nueva política upstream: check `pr-evidence.yml` exige imagen/vídeo bajo `### Before` y `### After` (acepta enlaces directos `https://…png`). Evidencia generada como capturas de terminal con `handoffs/tools/render_term.py` (PIL + Menlo), alojada en la rama huérfana `evidence` del fork (`raw.githubusercontent.com/gpechieu/munder-difflin/evidence/2026-09-06/pr-45{4,5}-{before,after}.png`). Descripciones reescritas con `.github/PULL_REQUEST_TEMPLATE.md`. Bot: "Evidence received" en ambos.
  - `origin/main` avanzó 81 commits (`3f53763f` → `3e4f9f62`, sigue 0.4.6). Tocan `hive.ts` (+231: outbox JSON malformado, HEAD.lock, gc autodetach), `workerWake.ts` (#358 edge-trigger: `inboxIds` en vez de `inboxCount`, cada id se anuncia UNA vez), `TasksKanban.tsx` (id en tarjetas), `test/worker-wake.test.cjs` (+4 tests).
  - **#454** rebasado limpio → `798b7881` (845/845, typecheck ok, force-with-lease).
  - **#455** reconstruido sobre upstream → `540da4c6`: `isStalledWorker` salta también la regla `announced` (un worker atascado no oyó el anuncio); nuevo hold `'announced'`; test "re-nudge tras cooldown aunque los ids ya se anunciaron" + "junk ids no cuentan" (10 tests, 844/844). Con #358 sin este fix, un nudge perdido dejaba al worker sin despertar para siempre.
- **Integración local:** worktree `../munder-difflin-integrate`, branch `integrate/upstream-20260907` desde `b3c15326`: `git merge origin/main` con conflictos en `package-lock.json` (ours), `src/main/index.ts` y `src/main/workerWake.ts` (theirs + reaplicación exacta de los hunks de #454 `patch-human-ask-index.js` y #455 `patch-worker-wake-v2.js`, ambos guardados en `handoffs/tools/`). `package.json` sin cambios upstream (deps locales intactas). Commit `de1b5635`; este handoff se commitea encima. Rama subida al fork.
- Decisiones: no avanzar `feature/…` ni reiniciar la app hasta aviso del usuario (Kevin trabajando). El avance debe ser `git merge --ff-only integrate/upstream-20260907` desde el árbol principal y luego reinicio de `npm run dev` (editar `src/` reinicia el main y mata PTYs).

## VALIDACIÓN
- #454: typecheck ok, 845/845. #455: typecheck ok, 844/844. Ambos con Build/Typecheck/Evidence en verde en GitHub tras la republicación (ver estado final en el mensaje de sesión; el #455 pasó de CONFLICTING a mergeable al rebasar).
- Integración `de1b5635`: typecheck ok, **855/855**; `git diff origin/main -- src test` = exactamente #454 (7 archivos) + #455 (3 archivos), 9 archivos. `git diff fix/human-ask-visibility -- src test` = solo #455 y viceversa.
- Boot real de la integración: PENDIENTE (requiere reinicio autorizado).
- Estado: TESTS PASANDO + COMPILACIÓN EXITOSA en integración; FUNCIONANDO CORRECTAMENTE solo para lo ya validado ayer (fixes en la app en marcha, versión pre-rebase).

## CONTINUIDAD
- Pendiente:
  1. Cuando el usuario avise: `cd munder-difflin && git merge --ff-only integrate/upstream-20260907`, matar Electron/electron-vite, `(nohup npm run dev >> dev.log 2>&1 &)`, verificar boot (broker/telemetry, PROTOCOL.md, Michael restaurado), `git push fork feature/god-workers-visibles-roster-guard`, y borrar worktree/branch `integrate/*`.
  2. Seguir #454/#455 (reviews). Worktrees de PR: `../munder-difflin-pr-human-ask` (`798b7881`), `../munder-difflin-pr-worker-wake` (`540da4c6`).
  3. Rotar la VT key (usuario). Candidatos: `.gitignore` del hive con `.secrets/`; `app.relaunch` en dev; umbrales de compactación de god.
- Riesgos: si upstream vuelve a mover `workerWake.ts`/`index.ts`, rehacer #455 con `patch-worker-wake-v2.js <root>` sobre `origin/main` (anclas exactas; falla si cambian).
- No tocar: `src/` del árbol principal mientras la app corra.

## GIT
- PRs: #454 `798b7881` · #455 `540da4c6` (fork `fix/*`). Integración: `de1b5635` + este handoff (fork `integrate/upstream-20260907`). `evidence` branch: `6dc13b46`.

---

## PARTE 2 (09:00–09:40) — CAUSA RAÍZ del worker que no lee su work order (Holly) y 3er fix

### HECHOS (todos observados en vivo, 2026-09-07 09:02–09:10)
- `log.jsonl`: worker-holly spawn 09:02:10, work order entregado a su inbox (`delivered:["worker-holly"]`).
- `fleet.json` a los 8 min: tokens 0, lastTool null, inboxBacklog 1. Sin transcript de su sesión. Proceso `claude` vivo.
- Watchdog (v2, ya en la app): `[worker-wake] holding worker-holly: mid-turn (mail pending 69s, pty quiet 0s, last activity 63s ago)`. Dos lecciones: la TUI de Claude NUNCA calla (`pty quiet 0s` idle en el prompt) y la muestra de telemetría de arranque (0 tokens) contaba como actividad.
- localStorage del renderer (LevelDB, UTF-16): `cth.messageQueues` = `{}` y worker-holly `status:"idle", action:"awaiting"` → el nudge de arranque SÍ se escribió al PTY, se dio por entregado y el CLI lo perdió. Sin reintento.
- Código: `terminalReadyToReceive(claude)` = hasOutput && 400ms (banner, no cuadro de entrada); `deliverWithAcknowledgement` acusa al resolver la escritura; el poll de inbox marca los ids como avisados al encolar. Kevin (spawn 08:39:44 → prompt 08:39:51) ganó la carrera; Holly y Stanley4 la perdieron.

### FIXES
- **fix/prompt-delivery-ack** (`1308d35b`, worktree `../munder-difflin-pr-prompt-ack`, PR abierto hoy): `PromptAckTracker` + `deliverWithConfirmation` en `queueDelivery.ts`; el drain de `useHive.ts` confirma cada entrega con el hook `UserPromptSubmit` (claude/codex/gemini), timeout 10s, reintento con cooldown, tras 3 fallos acuse por escritura + warning; slash commands y proveedores sin hook mantienen la regla vieja. Tests `prompt-delivery-ack` (10; 9/10 rojos en main). 844/844.
- **#455 v3** (`845dd0e6`): `activityEvidenceAt` = span de herramienta o muestra CON tokens. Tests 12; 846/846.
- Integración `integrate/upstream-20260907` = upstream + #454 + #455 v3 + prompt-ack: typecheck ok, **867/867** (`b7566f50` + docs).

### PENDIENTE
- FF a `feature/…` + reinicio (aviso del usuario). Hasta entonces, Holly y cualquier worker atascado se despiertan escribiendo "lee tu inbox y empieza la tarea" en su terminal.
- Validar en vivo tras el reinicio: (a) `[queue-drain] … did not report UserPromptSubmit … keeping it queued` seguido de entrega confirmada en un spawn frío; (b) `[worker-wake] nudging` para un worker atascado ≥90s.
