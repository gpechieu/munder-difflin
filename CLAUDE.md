# CLAUDE.md — munder-difflin (harness Electron "The Office")

App Electron (electron-vite + React + better-sqlite3 + node-pty) que orquesta agentes Claude Code como "empleados" en una oficina virtual. God = Michael (proxy del humano); workers = empleados contratados.

## Datos operativos clave
- **harnessHome** (datos de usuario, NO en este repo): `/Users/gastonpechieu/Develop/Oficina_Neus` — leído de `~/Library/Application Support/munder-difflin/config.json`.
- **Roster** (tarjetas del piso): `<harnessHome>/roster.json`, backups append-only en `roster-backups/` (nunca se pierde nada; ver `src/main/roster.ts`). El renderer es el dueño: mientras la app corre, cualquier edición externa del archivo será pisada por el próximo flush (500ms debounce + beforeunload). Para editarlo a mano: cerrar la app primero.
- **Hive** (workspaces de agentes): `<harnessHome>/hive/` — `registry.json`, `log.jsonl` (activity), `agents/<id>/` (identity.md, memory.md, inbox/, outbox/), `spawn-requests/` (cola de contrataciones de god; `.done`/`.failed`).
- Transcripts de sesiones de agentes: `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl` (config global, no per-agent).

## Flujos de spawn (3 caminos)
1. **Renderer** (AddAgentModal / restore team / auto-restore al boot con `resume:true`): `useRestoreTeam.ts`, persiste en roster.
2. **Voz (rt-5)**: MAIN spawnea y emite `hive:agentSpawned` → renderer crea la tarjeta.
3. **God (spawn-requests)**: `processSpawnRequest` en `src/main/index.ts` — workers "efímeros" (done→release, idle 20min→reap). Desde 2026-08-16 TAMBIÉN emite `hive:agentSpawned` (tarjeta + roster) y `teardownPty` emite `hive:agentArchived` al morir (todas las muertes pasan por ahí, salvo quit de la app — a propósito: así el card queda en roster y el reconcile del boot lo vuelve restaurable → auto-restore lo revive con resume).

## Gotchas aprendidos (no re-descubrir)
- `[roster] refused to overwrite...` en el log = el guard anti-borrado actuó. Desde 2026-08-16 el guard NO se desarma tras un rechazo (solo tras el primer write no-vacío) — test en `test/roster.test.cjs`.
- El quit de la app NO pasa por `teardownPty` (los agentes quedan `archived:false` en registry); la migración `archiveOrphanedAgents` los archiva al siguiente boot. Es el flujo normal, no un bug.
- Errores `trust_store_mac.cc: Error parsing certificate` en dev = ruido de Chromium/llavero macOS, ignorar.
- `[memory] mine <id> exited 1 ... chromadb NaN embeddings` = CoreML EP produce NaN con embeddinggemma cuantizado; RESUELTO 2026-08-16 forzando `MEMPALACE_EMBEDDING_DEVICE=cpu` en `memory.ts` (handoff 005). Si reaparece: verificar que el env llegue al miner y a los agentes. Para correr `mempalace` a mano: exportar `MEMPALACE_PALACE_PATH`, `MEMPALACE_EMBEDDING_MODEL=embeddinggemma` y `MEMPALACE_EMBEDDING_DEVICE=cpu`.
- Los mensajes user↔agente van por `inbox/`/`outbox/` del agent dir con env `AGENT_ID`/`AGENT_DIR`/`HIVE_*` inyectado al PTY.

## Validación (proyecto = app de escritorio)
- `npm run typecheck` + `npm run test:focused` (131 tests) + arranque real `npm run dev` (ver que Electron viva y el log sin errores nuevos).
- Si `npm run dev` da `Error: Electron uninstall`: `node node_modules/electron/install.js` (handoff 002).
- NO subir vite mientras electron-vite sea 5.x (peer `^5||^6||^7`); better-sqlite3 ≥13 para Electron 43 (handoff 001).

## Upstream (fork gpechieu → chaitanyagiri/munder-difflin)
- 8 PRs abiertos: #156-#162 + #178 (floor cards, APILADO sobre #159: los 2 primeros commits de #178 SON #159). Reviews del maintainer atendidas 2026-08-19 (handoffs 010-011): branches `fix/*` locales = estado exacto de los PRs — NO tocarlos sin rebasar #178 si #159 cambia (patrón `git rebase --onto`). #159 = `5d38c86` (auto-mode provider-aware vía `autoModeFlagForProvider` + stance-check por token + `commandForAutoMode` borrada), #178 = `ebdf65a`. 272/272 tests en ese stack (main upstream solo = 258).
- Decisiones pendientes DEL MAINTAINER: product call visibilidad workers (#178), sign-off autoMode/Slack, bounded-retry (#162). Ofrecido en #178: excluir tarjetas de god-workers del AUTO-restore (manual restore sigue = adopción como agente normal); implementar solo si lo pide.
- OJO divergencia: el feature branch local aún lleva las versiones PRE-review de esos fixes (pin mempalace incondicional, lista de 5 markers en pty.ts, tokenizer duplicado, sin hung-turn override en inboxWake, ansiText en components/, auto-mode claude-only en workerLaunch). Al mergear upstream, adoptar las formas revisadas localmente.

Handoffs cronológicos en `handoffs/`.
