# HANDOFF 015 - MERGE UPSTREAM v0.4.6 + CIERRE #156/#160 - 2026-09-04

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-IMPLEMENTADOR (handoff 014, merge v0.4.5)
- Último commit: 209b45e - docs: handoff 014
- Estructura encontrada: feature branch = upstream v0.4.5 + deps locales; sin commit: `package-lock.json` regenerado (0.4.4→0.4.5, reflejaba node_modules real) y header OpenWolf en CLAUDE.md sin `@import`; tooling local sin trackear (`.wolf/`, `.codex/`, `AGENTS.md`, `.claude/{commands,rules,settings.json,skills/openwolf}`).
- Problemas identificados: upstream publicó **v0.4.6 (2026-08-27)** y siguió hasta `f0e3a5b2` — 158 commits nuevos; el maintainer cerró #156 y #160 el 27-ago; un agente del maintainer comentó en #162 el 1-sep.

## 🔧 TRABAJO REALIZADO
- **Hallazgos en GitHub (2026-09-04):**
  - **#156 CERRADO como "Shipped in v0.4.6"** (maintainer, 27-ago): nuestro commit `ed8bc84f` entró por la release branch (`7dd424e7 Merge PR #156 into release/0.4.6-rc`), con el test de `test/roster.test.cjs`. Cerrado en vez de "merged" solo por la mecánica de la release branch. Autoría nuestra en el historial.
  - **#160 CERRADO como superseded por nuestro propio commit** (27-ago): `19646be8` "expand ~ at the two seams a pre-fix config can still reach" (autoría Gastón) ya estaba shipped desde antes de 0.4.5 y es la versión más amplia.
  - **#161 sigue OPEN**, sin novedades desde nuestro comentario del 19-ago (contenido ya en upstream: cherry-pick `a3b75f6` + carry `44bfb19`).
  - **#162 sigue OPEN**: el 1-sep un agente del maintainer ("posted by an agent on the Munder Difflin hive floor") flagueó que `workerWake.ts` (`68cbc25c`, otro autor, cita "#151, fix A") ya cubre lo mismo, y pidió decisión a @chaitanyagiri en vez de cerrar. Pendiente de respuesta del humano.
  - Issues abiertos por nosotros: ninguno.
- **Merge de `origin/main` (`f0e3a5b2`, incluye tag v0.4.6 = `ecda5a9a`)** → commit `c63359e4`. 2 conflictos:
  - `package.json`: resuelto = versión `0.4.6` + `i18next ^26.3.6`/`react-i18next ^17.0.11` (nuevos upstream) + bloque de deps LOCAL preservado (Electron ^43.4.0, better-sqlite3 ^13, electron-vite ^5, vite ^7, @electron/rebuild ^4, electron-builder ^26, **localtunnel ^1.8.3** — upstream sigue en ^2.0.2).
  - `package-lock.json`: `--ours` + `npm install` regenerado (electron 43.4.1, vite 7.3.6, localtunnel 1.9.2, i18next 26.4.2).
  - `src/main/roster.ts`: el auto-merge dejó el docstring viejo (nuestro cherry-pick `b63017d3` vs `ed8bc84f`); alineado con upstream en `ea9e6636`.
- **Resultado: `git diff origin/main -- src test` VACÍO** (100% upstream). Delta local = package.json/lock (deps) + CLAUDE.md + handoffs/.
- **Qué trae v0.4.6 + post** (para saber qué esperar en la app): UI en zh-CN y ar (react-i18next, RTL en terminales), auto-updater end-to-end con badge (primer arranque tras update muestra release notes — visto en el log: `[updater] first run of 0.4.6 (previous 0.4.5)`), fuentes bundled (sin Google Fonts), validación del nombre de comando antes de resolverlo en PATH (`ea7e0d2f`), ASK ME renderiza markdown, un solo botón Save en Settings, catálogo de modelos en JSON compartido (`a6e7e27a`), reset de usage al morir el PTY (#317), WebGL release en teardown (#323), `message_sent` telemetry, retry del proxy-bridge bind, PostHog sin IP/geo. Docs: README reescrito, mapa del código movido a `docs/`, CHANGELOG con sección 0.4.6.
- Tooling local añadido a `.git/info/exclude` (`.wolf/`, `.codex/`, `AGENTS.md`, `.claude/commands|rules|settings.json|skills/openwolf`) — no toca el `.gitignore` de upstream.
- Context7 usado: no (merge git + deps ya validadas en handoffs 001/014)
- Decisiones técnicas: misma política que 014 (deps locales; src/test wholesale upstream; diff final vacío como prueba anti-blend).

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` (node+web) limpio; `npm run test:focused` → **745/745 pass** (suite creció de 552 a 745 con v0.4.6); boot real `npm run dev` con hive del usuario (NEUS_Headquarters).
- Boot: vite 7.3.6 OK, `[updater] first run of 0.4.6 (previous 0.4.5); fetching its release page` → `just-updated 0.4.6 with release notes`, broker 63330 + telemetry 63331 up, keep-awake ON, agentes auto-restaurados. Cero errores nuevos de app (solo ruido trust_store_mac). App parada limpiamente tras la verificación (`ps | awk | xargs kill -9`).
- **Problema encontrado (NO del merge):** `[memory] mine <cada agente> exited 1: with a different embedding model`. HECHO: `memory.ts` no cambió en el rango del merge; `<harnessHome>/palace/mempalace_embedder.json` dice `model_name: "minilm"` (drawers y closets) mientras la config del usuario tiene `embeddingModel: "embeddinggemma"`; mempalace instalado = 3.7.1 (`~/.local/bin/mempalace`), que ahora rechaza minar con modelo distinto al del índice. Efecto: la memoria semántica NO se está actualizando (todos los miners salen con 1). Registrado en buglog `mempalace-embedding-model-mismatch`. Requiere decisión del usuario (ver abajo).
- Resultados obtenidos: EXITOSO (merge) / REQUIERE ATENCIÓN (memoria semántica, preexistente)
- Estado final: FUNCIONANDO CORRECTAMENTE (app) — mining de memoria REQUIERE ATENCIÓN

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: branches `fix/*` (estado exacto de #161/#162 hasta cierre); `.gitignore` (upstream); el palace del usuario sin decisión explícita.
- COMPLETAR (decisiones del usuario, ambas son datos/config de usuario):
  1. **Memoria semántica rota por mismatch de modelo.** Opción A (rápida, sin re-embed): en `~/Library/Application Support/munder-difflin/config.json` poner `"embeddingModel": "minilm"` (coincide con el índice actual). Opción B (mantener embeddinggemma): con la app CERRADA, `MEMPALACE_PALACE_PATH=/Users/gastonpechieu/Develop/NEUS_Headquarters/palace MEMPALACE_EMBEDDING_MODEL=embeddinggemma MEMPALACE_EMBEDDING_DEVICE=cpu mempalace --palace /Users/gastonpechieu/Develop/NEUS_Headquarters/palace repair rebuild-index` (re-embed en sitio; tarda). Verificar después que `[memory] mine ... exited 1` desaparece del log.
  2. `defaultWorkerTokenCap: 150000` → `0` (pendiente desde handoff 014; editar con la app cerrada).
  3. PRs #161 y #162: contenido ya en upstream. Opciones: esperar al maintainer, o comentar/cerrar nosotros con nota (acción outward-facing → decisión del usuario).
- CUIDADO CON: futuros merges → deps locales SIEMPRE (upstream Electron 32, localtunnel 2.x); `git diff origin/main -- src test` debe quedar vacío tras resolver; el auto-merge puede dejar docstrings viejos cuando un cherry-pick nuestro y el commit upstream coexisten (caso roster.ts).
- TESTEAR INMEDIATAMENTE: tras aplicar la decisión 1, arrancar la app y comprobar que los miners salen con 0.

## 📦 COMMITS REALIZADOS
- `9bb8bff3` chore: package-lock regenerado + header OpenWolf en CLAUDE.md
- `c63359e4` merge: upstream v0.4.6 + main (f0e3a5b2) - TESTED
- `ea9e6636` chore: roster.ts alineado con upstream
- `ead93a4a` chore: package-lock con i18next (quedó fuera del merge por orden de staging)
- (docs) handoff 015 + CLAUDE.md — commit siguiente a este handoff
