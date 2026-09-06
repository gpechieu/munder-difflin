# HANDOFF 016 — Oficina en producción: ASK ME invisible + worker que nunca arranca (2 fixes, PRs #454/#455) — 2026-09-06

## ESTADO INICIAL
- Branch/worktree: `feature/god-workers-visibles-roster-guard` @ `b24d378c` (= upstream main post-v0.4.6 + deps locales + docs).
- Contexto relevante: sesión de dogfooding real. El usuario creó el hive `NETLINK_CyberSecurity` y puso a Michael (Opus 1M) a orquestar un proyecto de threat-hunting anti-botnet con 14 workers efímeros (Oscar, Dwight×3, Jim, Pam, Angela, Stanley×4, Phyllis, Ryan, Toby, Darryl). Todos entregaron y se liberaron por el flujo normal; 0 reaps, 0 errores de memoria, 0 rechazos de roster, 0 errores de app en 3h+.

## CAMBIOS
- Creados:
  - `src/shared/humanAsk.ts` — definición única de "pregunta abierta" (`openQuestion`, `waitsOnHuman`, `openAsks`), importada por main y renderer.
  - `test/hive-human-ask.test.cjs` (7), `test/human-ask-open.test.cjs` (4), `test/worker-wake-stall.test.cjs` (9).
- Modificados:
  - `src/main/hive.ts` — `routeMessage`: un god→`human` request/query/propose sin destinatario se materializa como tarjeta `ask-<msgId>` blocked (título=subject, humanQA=body) → `delivered:["human"]` + log `human-ask`; inform/done → drop `human-fyi`. `tasks()` anuncia cada pregunta nueva (`hive:humanAsk` + notifier) sin re-anunciar tras boot. `PROTOCOL_MD` reescrito en "Asking the human".
  - `src/main/index.ts` — `setHumanAskNotifier` (toast nativo gated por `notifications`); `runWorkerWakeBeat` aporta `lastActivityAt` (telemetría) y `oldestMailAt`, y loggea `[worker-wake] holding <id>: <why>` una vez por cooldown.
  - `src/main/workerWake.ts` — `isStalledWorker`, `explain()`, `shouldReportHold()`, `WORKER_WAKE_STALL_MS=90s`, `WORKER_WAKE_REPORT_MS=60s`. Sin los campos nuevos, comportamiento idéntico.
  - `src/renderer/src/components/TasksKanban.tsx`, `src/renderer/src/scene/office/OfficeFloor.tsx` — usan el helper compartido; ya no exigen `status==='blocked'`.
- Decisiones:
  - Solución en el harness (invariantes), no en la disciplina del agente: el usuario prohibió parches ("busca verdadera SOLUCIÓN").
  - Los fixes se desarrollaron en worktrees aislados porque `npm run dev` vigila `src/` y un reinicio del main mata los PTYs de los agentes.
  - PRs rehechos sobre `origin/main` (3f53763f) con cherry-pick (2bf57144, caa0780c) para no arrastrar deps locales/handoffs.
  - Hallazgos de la sesión (no del harness): la key de VirusTotal acabó en 2 commits del git local del hive (tasks.json + workspace/.secrets); se desrastreó (`0ab5c59` en el repo del hive, `.gitignore` += `.secrets/`), sin remoto; recomendado rotar la key (pendiente del usuario). Michael se saltó `status: blocked` a 443k tokens tras hacerlo bien 3 veces (214k–331k); nunca compactó (trigger 40% de 1M no alcanzado a las 14:46).

## VALIDACIÓN
- Comandos ejecutados:
  - `npm run typecheck` → limpio (en ambos worktrees y en las ramas de PR).
  - `node --test --test-reporter=tap test/*.test.cjs` → 756/756 (ASK ME) y 754/754 (watchdog); rama integrada = 765 tests esperados (no ejecutada como suite única tras el merge; cada rama sí).
  - Regresión contra código viejo: hive-human-ask 6/7 fallan; worker-wake-stall 9/9 fallan.
  - Boot real tras integrar (`1721e354`): sin errores, PROTOCOL.md regenerado, Michael restaurado.
  - E2E en vivo: mensaje god→human por outbox → tarjeta `ask-…` blocked, `delivered:["human"]`, visible en ASK ME y respondida por el usuario. Luego Michael, avisado por inbox, reenvió sus 2 preguntas perdidas → 2 tarjetas en ASK ME.
- Resultado: FUNCIONANDO CORRECTAMENTE (ASK ME). El watchdog: TESTS PASANDO + typecheck; su rama de log `[worker-wake] holding` no se ha visto aún en vivo (no hubo worker atascado tras el fix).
- Estado: `1721e354` en la rama de trabajo, PRs #454 y #455 abiertos.

## CONTINUIDAD
- Pendiente:
  - Seguir los PRs #454/#455 (reviews del maintainer). Worktrees de PR: `../munder-difflin-pr-human-ask`, `../munder-difflin-pr-worker-wake`.
  - Rotar la API key de VirusTotal (decisión del usuario; sigue en 2 commits del historial local del hive).
  - Candidato upstream: `.gitignore` por defecto del hive con `.secrets/`, `*.key`, `.env` (buglog `hive-git-autocommits-secrets`).
  - Dev-mode: cambiar/crear hive relanza Electron y mata el dev server → ventana en blanco; workaround relanzar `npm run dev` (buglog `dev-changehome-relaunch-kills-vite`). Fix de código opcional (evitar `app.relaunch` en `is.dev`).
  - Verificar en vivo la línea `[worker-wake] holding/nudging` la próxima vez que un worker se quede con inbox sin leer.
- Riesgos: duplicado de pregunta si god manda mensaje a human Y añade humanQA a mano (el protocolo nuevo dirige a un solo camino).
- No tocar: `roster.json` con la app abierta; `tasks.json` a mano salvo emergencia (ya no necesario para ASK ME).

## GIT
- Commits: `1d3fae08` fix ASK ME · `45d5e624` fix watchdog · `10b3abb1`/`1721e354` merges en feature · `2bf57144`/`caa0780c` cherry-picks sobre origin/main (branches `fix/human-ask-visibility`, `fix/worker-wake-stall` en el fork).
- PRs: https://github.com/chaitanyagiri/munder-difflin/pull/454 · https://github.com/chaitanyagiri/munder-difflin/pull/455
