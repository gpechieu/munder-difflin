# HANDOFF 018 — Sesión de monitoreo con la oficina en producción; fix "inbox heredado al recontratar" (PR #472) — 2026-09-07

## ESTADO INICIAL
- Branch/worktree: `feature/god-workers-visibles-roster-guard` @ `ed44eb72` (handoff 017 parte 3). App arrancada desde ese árbol a las 11:01 con `(nohup npm run dev >> dev.log 2>&1 &)`.
- Contexto relevante: el usuario pidió ejecutar la app, usarla y monitorear errores reparables, recordando que upstream exige evidencia visual para publicar.
- **harnessHome actual = `/Users/gastonpechieu/Develop/NETLINK_CyberSecurity`** (config.json; el CLAUDE.md decía NEUS_Headquarters). OpenWolf de god vive en `<harnessHome>/hive/agents/god/.wolf` con hooks en `<harnessHome>/.claude/settings.json`.

## OBSERVACIÓN (11:01 → 17:10, HECHOS)
- Boot limpio; god resumió su sesión y recibió el nudge a los 5 s. El usuario habló con Michael a las 11:02 (M-BSAS) y respondió bien.
- god contrató 15 workers a lo largo del día (Darryl, Ryan, Phyllis, Stanley, Angela, Erin, Gabe, Kelly, Nellie, Robert, Roy, Jan, Hank, Clark, Andy): límite de 4 concurrentes respetado (los excedentes esperaron en `spawn-requests/` y entraron en el mismo tick del release), 14 `done` → release → `hive:agentArchived`, tarjetas visibles en roster/panel. Cero `[worker-wake] nudging`: los fixes #455/#463 no tuvieron que actuar; cada worker recibió su work order al primer intento.
- Flujo humanQA en real: respuesta humana en tarjeta del tablero → god la recibió → contrató a Nellie a los 2 min.
- Bloqueos de pantalla (uno de ~2 h 50 min): `[power] unlock-screen … N PTY(s) healthy`; los transcripts siguieron escribiéndose; Electron mantiene `NoIdleSleepAssertion`.
- OpenWolf en god: 12 hooks con latido OK, 0 fallos consecutivos; el governor Bash no recortó salidas.
- `dev.log` sin errores nuevos (ruido conocido: `trust_store_mac`, `Invalid mailbox`). PRs #454/#455/#463 sin reviews; `origin/main` sigue en `3e4f9f62`.

## HALLAZGO Y FIX
- **Bug:** `workerId = worker-<nombre del spawn-request>`; god contrata por personaje → cada recontratación reutiliza el directorio anterior. Los workers casi nunca mueven su work order a `inbox/.done` antes del `done`, y el release no tocaba el inbox → la nueva incarnación arranca con órdenes ya cumplidas como "pendientes" (Phyllis: nudge de boot listando el id de ayer; el watchdog: `mail pending 77359s` a los 30 s del spawn; 13 de 30 inboxes con órdenes terminadas; phyllis con 3, incluido un inform de Ryan entregado tras su archivado). Buglog: `worker-rehire-inherits-stale-inbox`.
- **Fix (PR #472, branch `fix/settle-inbox-on-done`, commit `b165df55` sobre `origin/main` `3e4f9f62`, worktree `../munder-difflin-fix-inbox-settle`):** `hive.settleInbox(id)` (inbox/*.json → inbox/.done, log `inbox-settled`, commit) llamado SOLO en la rama done de `ephemeralWorkerTick` antes del kill. Reaps por idle/token-cap no lo hacen.
- Evidencia: `raw.githubusercontent.com/gpechieu/munder-difflin/evidence/2026-09-07/pr-settle-{before,after}.png` (worktree `../munder-difflin-evidence`, commit `f7a186b4`). Checks del PR: Build, Typecheck y "Before / after evidence" en verde (17:12).
- NO cubierto (decisión de diseño aparte): correo a un agente archivado sigue marcándose `delivered` y acumulándose en su inbox.

## VALIDACIÓN
- Worktree del fix: `npm run typecheck` limpio; `node --test --test-reporter=tap test/*.test.cjs` **838/838**; `test/worker-inbox-settle.test.cjs` 4/4 verde y **4/4 rojo contra main** (stash de src).
- Estado: TESTS PASANDO + COMPILACIÓN EXITOSA en la rama del PR. FUNCIONANDO CORRECTAMENTE: la app en marcha (versión `ed44eb72`, sin este fix) durante 6 h de uso real. Boot real del fix: PENDIENTE (reinicio mata PTYs).

## CONTINUIDAD
- Pendiente:
  1. Seguir CI/reviews de #472 (y #454/#455/#463).
  2. Cuando el usuario acepte reiniciar: cherry-pick `b165df55` sobre `feature/god-workers-visibles-roster-guard` (o merge de `fix/settle-inbox-on-done`), typecheck + suite, reinicio, y verificar en `dev.log` `[worker] <id>: filed N unread inbox message(s)` tras el primer `done`.
  3. Limpieza opcional del hive NETLINK: los 12 inboxes archivados con órdenes viejas se pueden mover a `.done` a mano con la app cerrada (o dejar que el fix los limpie a medida que se recontraten).
  4. Corregir harnessHome en CLAUDE.md (hecho en este commit).
- Riesgos: ninguno nuevo; el fix es aditivo y best-effort.
- No tocar: `src/` del árbol principal mientras `npm run dev` corra; `../munder-difflin-pr-*` (estado exacto de cada PR).

## GIT
- Commit del fix: `b165df55` (fork `fix/settle-inbox-on-done`, PR upstream #472).
- Este handoff + CLAUDE.md: commit en `feature/god-workers-visibles-roster-guard` (hash en el mensaje final de sesión).

## ACTUALIZACIÓN 21:55 — #472 integrado y oficina reiniciada
- Con la app cerrada por el usuario: `git cherry-pick -x b165df55` sobre `feature/god-workers-visibles-roster-guard` → `8100771b` (limpio). Typecheck OK, suite **871/871**, push al fork.
- Reinicio 21:48 sin errores; god restaurado (sesión `ced45bae`), OpenWolf `session-start` 19:48:15Z, keep-awake ON. Los 4 fixes (#454/#455/#463/#472) en producción.
- Pendiente: reviews upstream de los 4 PRs; decisión del usuario sobre correo a agentes archivados (no cubierto por #472). Fin de sesión de pruebas.
