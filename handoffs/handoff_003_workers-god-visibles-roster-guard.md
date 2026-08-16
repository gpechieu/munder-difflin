# HANDOFF 003 - WORKERS DE GOD VISIBLES/RESTAURABLES + FIX GUARD ROSTER - 2026-08-16

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-DOCUMENTADOR (handoff 002)
- Último commit: c2204db - docs: registrar hash definitivo en handoff 002
- Estructura encontrada: branch `fix/vite7-electron-vite-peers` limpio; app dev funcional. Branch nuevo `feature/god-workers-visibles-roster-guard` creado desde ese HEAD (main no tiene aún los fixes de deps de handoff 001, por eso no se ramificó desde main).
- Problemas identificados (reporte del humano: "solo cargó Michael, no cargó al otro empleado contratado"):
  1. Ryan (`worker-marketing`), contratado por god vía `spawn-requests/`, NUNCA tuvo tarjeta en el piso ni entrada en roster: `processSpawnRequest` no emitía `hive:agentSpawned` ("headless-by-design"). Tras reiniciar, la migración lo archivó en el hive sin nada que ofreciera restaurarlo. Evidencia: ningún backup de roster lo contiene; god sí pidió un empleado completo (rol/modelo/descr. en `.done/marketing-ryan-v3.json`, campos que el flujo ignoraba).
  2. Guard anti-borrado de `roster.ts` se desarmaba tras el PRIMER rechazo (`this.wrote = true` en la rama declined): el segundo write vacío de un run aplastaba el archivo. Visto en vivo: backups `20-38-47 declined` → `20-40-03` roster aplastado a 151 bytes.

## 🔧 TRABAJO REALIZADO
- Archivos MODIFICADOS:
  - `src/main/roster.ts` — guard NO se desarma en rechazo; solo el primer write NO-vacío arma `wrote`. Comentarios actualizados con el caso real.
  - `src/main/index.ts` — (a) `processSpawnRequest` emite `hive:agentSpawned` tras spawn OK (misma forma que el spawn por voz línea ~3900); (b) `teardownPty` emite `hive:agentArchived` si el PTY era un worker efímero (`liveWorkers`), cubriendo done-release/reap/crash en un punto único. El quit de la app no pasa por teardownPty → el card sobrevive en roster → reconcile lo hace restaurable → auto-restore (2.5s, `useRestoreTeam.ts`) lo revive con `resume:true`.
  - `test/roster.test.cjs` — test de regresión: writes vacíos repetidos siguen rechazados hasta un write no-vacío; luego el vacío es borrado legítimo.
- Archivos CREADOS: `CLAUDE.md` del proyecto (datos operativos: harnessHome, roster/hive, 3 flujos de spawn, gotchas), este handoff.
- Recuperación de datos (fuera del repo): Ryan re-inyectado como `restorable` en `<harnessHome>/roster.json` con la app cerrada (el 1er intento con app abierta fue pisado por el flush del renderer — lección: cerrar la app antes de editar roster.json).
- Context7 usado: no aplicable — lógica interna de la app, diagnóstico sobre fuentes primarias (backups de roster, hive/log.jsonl, registry).
- Decisiones técnicas: el humano eligió explícitamente "empleados de god visibles y restaurables" sobre mantener el headless-by-design; ciclo efímero (release/reap) se conserva pero visible.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas:
  - `npm run typecheck` → sin errores.
  - `npm run test:focused` → **131 tests, 131 pass** (130 previos + regresión nueva).
  - Arranque real `npm run dev` → app viva, sin `[roster] refused` en el boot, Ryan auto-restaurado: `roster.json` pasó a `agents: god, worker-marketing`; registry `archived:false`; proceso de Ryan con env completo (`AGENT_ID=worker-marketing`, `AGENT_DIR`, `HIVE_ROOT/NODE/SOCK`); inbox con 2 mensajes de god intactos.
  - Smoke E2E del flujo god→worker: drop de `spawn-requests/smoke.json` → `[worker] spawned worker-smoke` → tarjeta creada y persistida → al morir el PTY, card archivado (`archived: worker-smoke` en roster). **Ambos broadcasts nuevos validados con spawn real.**
- Resultados obtenidos: EXITOSO
- Problemas encontrados: (1) el CLI del worker-smoke murió ~900ms tras spawn sin ejecutar la tarea (outbox vacío); el MISMO comando (`claude --model claude-haiku-4-5-20251001 --permission-mode bypassPermissions -p`) funciona standalone → causa dentro del entorno de spawn aún sin identificar (los broadcasts hicieron visible el fallo, antes era silencioso). (2) Transcript de la sesión previa de Ryan (`baeffc24`) nunca se escribió en disco → el resume cayó al fallback documentado (terminal fresca; identity/memory/inbox reattachan igual). (3) Miner de mempalace falla con `chromadb ... NaN embeddings` para todos los agentes en cada boot.
- Reparaciones realizadas: descritas arriba (guard, broadcasts, re-inyección de Ryan).
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: versiones vite/electron-vite/better-sqlite3 (handoffs 001/002); `roster-backups/` (append-only, es la red de seguridad).
- COMPLETAR: (a) investigar muerte instantánea del CLI en workers spawneados por la app (comparar env/flags del PTY vs shell; probar próxima contratación real de god); (b) bug del miner mempalace (NaN embeddings) — la memoria de agentes no se indexa; (c) card `worker-smoke` quedó en archivados del piso — el humano puede borrarlo desde la UI (y su dir en `hive/agents/worker-smoke` + entrada en registry son residuos del test, inofensivos); (d) merge de este branch y de `fix/vite7-electron-vite-peers` cuando el humano apruebe; (e) `npm audit` pendiente de handoff 001.
- CUIDADO CON: editar `<harnessHome>/roster.json` con la app abierta (el renderer lo pisa); el quit sin teardown es INTENCIONAL (habilita el restore).
- TESTEAR INMEDIATAMENTE: próxima contratación real de god → debe aparecer la tarjeta al instante y, tras reiniciar la app, ofrecerse/restaurarse solo.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: workers contratados por god visibles en el piso y restaurables tras reinicio; guard del roster no se desarma tras un rechazo - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: eb366b0
