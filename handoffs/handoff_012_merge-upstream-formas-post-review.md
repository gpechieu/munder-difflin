# HANDOFF 012 - MERGE UPSTREAM v0.4.4 + ADOPCIÓN LOCAL DE LAS FORMAS POST-REVIEW DE LOS 8 PRS - 2026-08-20

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-REVIEWER (handoff 011, commits 4d9f424/18f763a)
- Último commit: 18f763a - docs: registrar hash definitivo en handoff 011
- Estructura encontrada: feature branch con las versiones PRE-review de los fixes (divergencia documentada en CLAUDE.md); 8 PRs abiertos upstream sin respuesta nueva del maintainer (última actividad = la nuestra, 2026-08-19 17:19); upstream main avanzó a 1a805ea (v0.4.4) pero solo blog/wall/docs desde 104f006; entre 255d926 (base del feature) y 1a805ea hay ~6.800 líneas de app nuevas (features v0.4.4: skills, hero-payload, win-cmd-shim, etc.).
- Problemas identificados: el branch de uso diario del usuario llevaba (a) el bug auto-mode claude-only en workers de otro provider, (b) las formas pre-review de los otros 5 fixes, (c) atraso de ~49 commits vs upstream.

## 🔧 TRABAJO REALIZADO
- **Branch de integración** `integration/upstream-8-fixes` (CONSERVADO como referencia): origin/main 1a805ea + merges secuenciales de los 8 fix/* (floor-cards trae el stack #159+#178). Únicos conflictos: la línea `test:focused` de package.json entre PRs (resuelta por unión con helper python); el código de los 8 PRs mergeó limpio entre sí.
- **Merge a feature** (commit `e64c543`): conflictos en los 13 archivos del solape pre/post-review, resueltos adoptando `src/` y `test/` WHOLESALE desde la integración (válido porque el delta de app del feature estaba 100% cubierto por los PRs — verificado por diff de archivos antes de decidir). `src/renderer/src/components/ansiText.ts` eliminado (huérfano; la review lo movió a `src/shared/`; cero referencias residuales verificadas con grep). package.json: versión y scripts de upstream (0.4.4, test:focused ampliado) + bloque de deps LOCAL restaurado a mano (Electron ^43.4.0, better-sqlite3 ^13.0.3, electron-vite ^5.0.0, vite ^7.3.6, @electron/rebuild ^4.2.0, electron-builder ^26.15.3, localtunnel ^1.8.3). package-lock: nuestro (upstream no lo tocó en el rango).
- **Verificación estructural**: `git diff integration HEAD -- src/ test/` = VACÍO (cero blends textuales del auto-merge); delta restante vs integración = solo CLAUDE.md, handoffs/, deps y lock.
- Archivos MODIFICADOS: package.json (deps), CLAUDE.md (divergencia resuelta + conteo tests), .wolf/{STATUS.md,cerebrum.md,buglog.json} (sin commitear, tooling local).
- Archivos CREADOS: este handoff. Vía merge llegan los módulos post-review (workerLaunch.ts, ptyEnv.ts, shared/ansiText.ts, shared/commandLine.ts) + features upstream v0.4.4 + `.claude/skills/ian-xiaohei-illustrations/`.
- Context7 usado: no aplicable (merge de código propio + upstream ya revisado; sin tecnología nueva).
- Decisiones técnicas: integración en `git worktree` separado (el checkout directo a base upstream aborta: upstream no trackea CLAUDE.md y el local tenía cambios sin commitear — el header OpenWolf, que se dejó SIN commitear tal como estaba); "wholesale + diff final vacío" en vez de resolver hunk por hunk, para eliminar riesgo de blends.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` (node+web), `npm run test:focused`, suite completa `node --test test/*.test.cjs`, boot real `npm run dev` con log capturado, verificación de cero referencias a components/ansiText.
- Comandos probados: los de arriba + `git diff integration HEAD -- src/ test/` (vacío).
- Resultados obtenidos: EXITOSO — typecheck limpio; **288/288** test:focused; **307/307** suite completa (el código v0.4.4 + 8 PRs corre sobre Electron 43); Electron arrancó (broker 58043 + telemetry 58044 up, hive activo, auto-restore revivió `worker-testy` del roster), sin errores nuevos en log (solo el ruido conocido de trust_store_mac).
- Problemas encontrados: (1) merge accidental sobre el feature branch: un `checkout | tail && merge` encadenado — el pipe se tragó el abort del checkout y el merge corrió en el branch equivocado; (2) instancia dev resistente al primer kill (Electron reparentado a launchd respawneando helpers).
- Reparaciones realizadas: (1) `git merge --abort` restauró el estado exacto y se rehizo en worktree (loggeado en .wolf/buglog.json y cerebrum Do-Not-Repeat); (2) kill -9 directo al proceso principal, verificado 0 procesos residuales.
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: `fix/*` branches (= estado exacto de los PRs #156-#162/#178: 5d38c86, ebdf65a, ed8bc84, eca75c4, 70092b6, 3a879c5, 0a4c4b0, 8fc3d25); `integration/upstream-8-fixes` (referencia de la alineación).
- COMPLETAR: monitorear las 3 decisiones del maintainer (visibilidad #178, autoMode/Slack, bounded-retry #162); si acepta la exclusión de auto-restore → tag en payload `hive:agentSpawned` + filtro en `useRestoreTeam.ts`; pendientes heredados (bug report mempalace, npm audit).
- CUIDADO CON: en futuros merges upstream, el bloque de deps de package.json es LOCAL (Electron 43; upstream sigue en 32) — nunca resolver "theirs" completo; el header OpenWolf de CLAUDE.md sigue sin commitear a propósito (importa `.wolf/` untracked).
- TESTEAR INMEDIATAMENTE: si el usuario reporta rarezas en su dogfooding, primero `git diff integration/upstream-8-fixes HEAD -- src/` (debe seguir vacío) para descartar drift.

## 📦 COMMIT REALIZADO
```
git commit -m "merge: upstream main v0.4.4 (1a805ea) + los 8 PRs en forma post-review (#156-#162, #178) - adopta workerLaunch provider-aware, ptyEnv, shared/ansiText, watchdog con hung-turn override; conserva stack local Electron 43 - Agente Claude-IMPLEMENTADOR"
```
Hash: e64c543 (merge) + 24b4b40 (docs: este handoff + CLAUDE.md)
