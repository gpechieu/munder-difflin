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
- `npm run typecheck` + `npm run test:focused` (= suite completa, glob `test/*.test.cjs`, 745 tests tras v0.4.6) + arranque real `npm run dev` (ver que Electron viva y el log sin errores nuevos).
- Si `npm run dev` da `Error: Electron uninstall`: `node node_modules/electron/install.js` (handoff 002).
- NO subir vite mientras electron-vite sea 5.x (peer `^5||^6||^7`); better-sqlite3 ≥13 para Electron 43 (handoff 001).

## Upstream (fork gpechieu → chaitanyagiri/munder-difflin)
- **Estado de nuestros 8 PRs (2026-09-04):** MERGEADOS con hashes exactos: #157 (`eca75c4`), #158 (`70092b6`), #159 (`5d38c86`), #178 (`ebdf65a`). CERRADOS como shipped (27-ago): #156 (`ed8bc84f` entró vía release/0.4.6-rc, cerrado en vez de merged solo por mecánica), #160 (superseded por nuestro propio `19646be8`, más amplio). **Aún OPEN: #161 y #162**, ambos ya cubiertos en upstream (#161: cherry-pick `a3b75f6` + carry del maintainer `44bfb19`; #162: `workerWake.ts` de otro autor `68cbc25c`; el 1-sep un agente del maintainer lo flagueó y pidió decisión a @chaitanyagiri). Branches `fix/*` locales conservan el estado exacto de los PRs.
- **v0.4.6 mergeado localmente 2026-09-04 (merge `c63359e4`, handoff 015; antes v0.4.5 en `1275db5`, handoff 014)**: `src/`+`test/` = 100% idénticos a upstream main (`f0e3a5b2`, post v0.4.6). Suite: 745 tests (`test:focused` = glob `test/*.test.cjs`). Único delta local intencional: bloque deps en package.json (Electron ^43, better-sqlite3 ^13, electron-vite ^5, vite ^7, @electron/rebuild ^4, electron-builder ^26, localtunnel ^1.8.3 — upstream ^2.0.2) + package-lock + docs/handoffs — upstream sigue en Electron 32: en futuros merges PRESERVAR el stack local de deps (scripts y deps NUEVAS como i18next sí se toman de upstream). Prueba anti-blend tras resolver: `git diff origin/main -- src test` debe quedar VACÍO.
- **Novedades v0.4.6:** UI zh-CN/ar (react-i18next), auto-updater end-to-end (badge + release notes al primer arranque tras update), fuentes bundled, validación del nombre de comando antes de PATH, ASK ME en markdown, catálogo de modelos en JSON compartido, reset de usage al morir PTY, README/docs reorganizados (mapa del código en `docs/`).
- **Bug token-cap RESUELTO upstream** (`06879a3`, Ed Chan, en v0.4.5): transcriptFallback filtra por sessionId del propio agente. OJO: el cap sigue sumando cacheRead+cacheCreation, así que `defaultWorkerTokenCap: 150000` en config sigue siendo demasiado bajo para workers reales — recomendado ponerlo a 0 (ilimitado, default upstream).
- **Memoria semántica (mempalace) REQUIERE ATENCIÓN desde 2026-09-04:** el palace está indexado con `minilm` (`<harnessHome>/palace/mempalace_embedder.json`) pero config pide `embeddingModel: "embeddinggemma"`; mempalace 3.7.1 rechaza minar (`[memory] mine <id> exited 1: with a different embedding model`). Fix = cambiar config a minilm, o re-embed con `mempalace --palace <harnessHome>/palace repair rebuild-index` (app cerrada, env de la sección Gotchas). Ver buglog `mempalace-embedding-model-mismatch`.

Handoffs cronológicos en `handoffs/`.
