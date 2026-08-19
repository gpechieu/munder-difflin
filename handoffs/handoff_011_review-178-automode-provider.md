# HANDOFF 011 - REVIEW #178 ATENDIDA: AUTO-MODE PROVIDER-AWARE EN #159, #178 REBASADO, 3 PREGUNTAS RESPONDIDAS - 2026-08-19

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-REVIEWER (handoff 010, commits 665c2da/a40b217)
- Último commit: a40b217 - docs: registrar hash definitivo en handoff 010
- Estructura encontrada: el maintainer publicó (2026-08-19 17:01, comment 5345398887) la review del PR #178 — favorable, sin merge. 1 defecto bloqueante + 3 preguntas + 1 sugerencia de stacking. El main del upstream avanzó 4 commits (92461ab→104f006) pero son SOLO blog/wall — cero código de la app, no forzaba rebase. Los otros 7 PRs (#156-#162): sin actividad nueva desde nuestras respuestas de la mañana.
- Problemas identificados: (1) `buildWorkerLaunch` hardcodeaba provider Y flag de auto-mode a claude (`--permission-mode bypassPermissions`) → un worker god-hired de otro provider (codex/agy/kimi…) no recibía SU flag y se colgaba en el primer ask hasta que el idle reaper lo mataba — defecto REAL, verificado contra el código; (2) `commandForAutoMode()` en `src/main/config.ts`: dead code (cero call sites, verificado con git grep) que resolvía exactamente esto — tercera implementación paralela de la misma idea; (3) pregunta de producto sin decidir: worker restaurado revive como agente normal sin cap ni reaper.

## 🔧 TRABAJO REALIZADO
- **Decisión de stacking clave**: el defecto vive en `workerLaunch.ts`, que lo introduce el COMMIT DE #159 (51332ab), no el commit top de #178 → el fix va como **commit incremental sobre el branch de #159** (fast-forward: no invalida la review previa del maintainer sobre 51332ab) y #178 se rebasa encima. Arreglarlo solo en #178 habría dejado a #159 mergeable con el bug.
- **Fix (commit `5d38c86` en `fix/god-worker-spawn-lifecycle`)**: shape del reviewer adoptado (`autoModeFlagForProvider(provider)` — la misma fuente de verdad que usa el spawn path del renderer) CON refinamiento propio: el stance-check pasa a **nivel de token** (`tokenizeCommand(command).includes(tokenizeCommand(autoFlag)[0])`) porque su sketch usaba substring y el flag de copilot empieza por `-s`, que es substring de `--summarize` → habría saltado el append en falso. `commandForAutoMode` borrada + sus 3 imports huérfanos (`autoModeFlagForProvider`/`defaultCommandForProvider`/`inferAgentProvider` no tenían otro consumidor en config.ts). Quedan 2 implementaciones, ambas leyendo el mismo preset field.
- **Tests** (`test/worker-launch.test.cjs`, +5 netos): flag del provider (codex `--dangerously-bypass-approvals-and-sandbox` / agy `--dangerously-skip-permissions` / kimi `--auto`), stance explícito gana sin duplicar flag, providers sin autoFlag (opencode/custom) no reciben nada, flag multi-token se appendea entero + check por token (caso copilot `--summarize`), `requestProvider` explícito gana a la inferencia por binario.
- **Rebase #178**: `fix/god-worker-floor-cards` → `ebdf65a` (rebase --onto limpio; el commit top solo toca index.ts).
- **Publicado**: push fork (159 fast-forward `51332ab..5d38c86`, 178 force-with-lease `aa50aa7...ebdf65a`); body de #178 actualizado ("first TWO commits are #159", 272/272, nota de que cross-fork no se puede poner el branch de #159 como base — GitHub solo acepta bases del repo base); comment en #178 (5345590977) respondiendo las 3 preguntas; comment en #159 (5345592362) avisando del fast-forward (link al review comment CORREGIDO vía PATCH — el primer intento llevaba un ID inventado, lección: verificar IDs antes de enlazar).
- **Pregunta 2 (restore) respondida con posición, no código**: manual restore = intencional (el cap era término de la contratación de god, que murió; restaurar es una contratación NUEVA del humano); auto-restore al boot = herencia NO decidida (quit de la app ⇒ worker revive sin cap ni reaper en silencio). Propuesta ofrecida: excluir tarjetas de worker SOLO del auto-restore (siguen restaurables a mano) — en espera del product call de chaitanyagiri sobre visibilidad, que podría dejar todo moot.
- Archivos MODIFICADOS del repo local: solo este handoff + CLAUDE.md (el código vive en los PR branches del fork).
- Context7 usado: no aplicable — fix sobre código propio contra presets ya presentes en el branch.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: en worktree aislado con `npm ci` del lockfile upstream — POR CADA branch (`fix/god-worker-spawn-lifecycle` y `fix/god-worker-floor-cards`): `npm run typecheck` (node+web) + suite completa `node --test test/*.test.cjs`.
- Comandos probados: `git grep commandForAutoMode` (solo definición), rebase --onto, push fast-forward + force-with-lease.
- Resultados obtenidos: EXITOSO — typecheck limpio y **272/272** en ambos branches (main solo = 258; antes del fix = 267).
- Problemas encontrados: enlace con issuecomment-ID inventado en el primer comment de #159 (no verifiqué el ID real 5345398887 antes de publicar).
- Reparaciones realizadas: PATCH del comment con el ID correcto, verificado contra la API.
- Estado final: TESTS PASANDO (por branch, matriz upstream; el repo local no cambió de comportamiento)

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: `fix/god-worker-spawn-lifecycle` (5d38c86) y `fix/god-worker-floor-cards` (ebdf65a) = estado exacto de PRs #159/#178. Si #159 vuelve a cambiar, rebasar #178 (patrón: `git rebase --onto`).
- COMPLETAR: (a) monitorear las 3 decisiones del maintainer: product call de visibilidad (#178), sign-off autoMode/Slack, bounded-retry #162 (sin respuesta aún); (b) si acepta la exclusión de auto-restore: el spawn broadcast debe tagear la tarjeta (payload de `hive:agentSpawned` en processSpawnRequest) y el auto-restore de `useRestoreTeam.ts` filtrar por el tag; (c) **al mergear upstream: adoptar localmente las formas revisadas** — el feature branch local sigue con las versiones PRE-review Y ADEMÁS ahora sin el auto-mode provider-aware; (d) pendientes heredados (bug report a mempalace, npm audit, merges locales).
- CUIDADO CON: la divergencia local crece con cada fix de review — el `buildWorkerLaunch` local (si se copia del feature branch) tiene el bug claude-only; la versión buena es la de 5d38c86.
- TESTEAR INMEDIATAMENTE: nada en el repo local (no cambió). Los PR branches ya validados arriba.

## 📦 COMMIT REALIZADO
```
git commit -m "docs: handoff 011 - review #178 atendida: auto-mode provider-aware en #159 (5d38c86), #178 rebasado (ebdf65a), 3 preguntas respondidas - Agente Claude-REVIEWER"
```
Hash: [pendiente - se registra en commit posterior, patrón handoffs 008-010]
Branches fork: #159 `5d38c86` (fast-forward desde 51332ab) · #178 `ebdf65a` · resto sin cambios (ed8bc84/eca75c4/70092b6/3a879c5/0a4c4b0/8fc3d25)
