# OpenWolf

This project uses OpenWolf for context management. The always-on rules live in `.claude/rules/openwolf.md`; the hooks handle bookkeeping (anatomy index, memory log, read tracking) automatically.

For the full operating protocol (session handoff, memory discipline, bug logging), load the `openwolf` skill, or read `.wolf/OPENWOLF.md`. Regenerate the session handoff with `/handoff`.


# CLAUDE.md — munder-difflin (harness Electron "The Office")

App Electron (electron-vite + React + better-sqlite3 + node-pty) que orquesta agentes Claude Code como "empleados" en una oficina virtual. God = Michael (proxy del humano); workers = empleados contratados.

## Datos operativos clave
- **harnessHome** (datos de usuario, NO en este repo): `/Users/gastonpechieu/Develop/NEUS_Headquarters` desde 2026-08-20 (antes `Oficina_Neus`; hives recientes también: `QA_Difflin_A`) — leído de `~/Library/Application Support/munder-difflin/config.json`. OJO: esa config tiene `defaultWorkerTokenCap: 150000`, que aplica a TODA contratación de god sin cap propio (ver buglog `worker-token-cap-cwd-contamination`).
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
- `npm run typecheck` + `npm run test:focused` (288 tests; suite completa `node --test test/*.test.cjs` = 307) + arranque real `npm run dev` (ver que Electron viva y el log sin errores nuevos).
- Si `npm run dev` da `Error: Electron uninstall`: `node node_modules/electron/install.js` (handoff 002).
- NO subir vite mientras electron-vite sea 5.x (peer `^5||^6||^7`); better-sqlite3 ≥13 para Electron 43 (handoff 001).

## Upstream (fork gpechieu → chaitanyagiri/munder-difflin)
- **2026-08-22: 4 de los 8 PRs MERGEADOS a main** con nuestros hashes exactos: #157 (`eca75c4`), #158 (`70092b6`), #159 (`5d38c86`), #178 (`ebdf65a`). Además #156 fue cherry-pickeado a main (`b63017d`, autoría nuestra) aunque el PR sigue OPEN.
- **PRs aún abiertos (sin comentarios nuevos del maintainer): #156, #160, #161, #162** — pero su contenido ya está cubierto en upstream: #156 cherry-pickeado; #160 subsumido por #165 (rajpreetcodes, mergeado); #161: upstream cherry-pickeó nuestro commit original (`a3b75f6`) y el maintainer añadió su propio carry-over de escapes parciales (`44bfb19`, en `src/renderer/src/components/ansiText.ts`); #162 superseded por el watchdog `workerWake.ts` de otro contribuidor (Aravind Rao, `68cbc25`). Probable cierre próximo de los 4; branches `fix/*` locales conservan el estado exacto de los PRs.
- **v0.4.5 mergeado localmente 2026-08-22 (merge `1275db5`, handoff 014)**: `src/`+`test/` = 100% idénticos a upstream main v0.4.5 (`31ac125`) — se adoptó workerWake/ansiText de upstream retirando nuestras formas post-review de #161/#162 de la rama de integración. Suite: 552 tests; `test:focused` ahora es glob (`test/*.test.cjs`). Único delta local intencional: bloque deps en package.json (Electron ^43, better-sqlite3 ^13, electron-vite ^5, vite ^7, @electron/rebuild ^4, localtunnel ^1.8.3) + package-lock + docs/handoffs — upstream sigue en Electron 32: en futuros merges PRESERVAR el stack local de deps (los scripts sí se toman de upstream).
- **Bug token-cap RESUELTO upstream** (`06879a3`, Ed Chan, en v0.4.5): transcriptFallback ahora filtra por sessionId del propio agente — exactamente el bug del handoff 013/buglog. OJO: el cap sigue sumando cacheRead+cacheCreation, así que `defaultWorkerTokenCap: 150000` en config sigue siendo demasiado bajo para workers reales — recomendado ponerlo a 0 (ilimitado, default upstream).

Handoffs cronológicos en `handoffs/`.
