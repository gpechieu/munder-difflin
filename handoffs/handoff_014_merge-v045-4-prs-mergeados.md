# HANDOFF 014 - MERGE UPSTREAM v0.4.5 + 4 PRs MERGEADOS - 2026-08-22

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-TESTER (handoff 013, dogfooding + diagnóstico bug token-cap)
- Último commit: 4fbdd9f - docs: registrar hash definitivo en handoff 013
- Estructura encontrada: feature branch alineado con upstream v0.4.4 + 8 PRs post-review (handoff 012)
- Problemas identificados: upstream publicó v0.4.5 (192 commits nuevos); había que ponerse al día

## 🔧 TRABAJO REALIZADO
- **Hallazgos en GitHub (2026-08-22):**
  - **4 PRs nuestros MERGEADOS a main** hoy 07:01Z, con nuestros hashes exactos (sin modificación del maintainer): #157 (`eca75c4`), #158 (`70092b6`), #159 (`5d38c86`), #178 (`ebdf65a`). El maintainer revirtió el #159 original en main (`73e4fef`) y replayó el stack post-review.
  - **#156 cherry-pickeado a main** (`b63017d`, autoría Gastón) aunque el PR sigue OPEN.
  - **#160 subsumido** por #165 (rajpreetcodes, mergeado). **#161**: upstream cherry-pickeó nuestro commit original (`a3b75f6`) y el maintainer añadió su propio carry-over (`44bfb19`). **#162 superseded** por `workerWake.ts` de Aravind Rao (`68cbc25`) — mismo problema #151, solución distinta (nudge tipeado desde main con cooldown).
  - **Bug token-cap del handoff 013 YA ARREGLADO upstream** (`06879a3`, Ed Chan): transcriptFallback filtra por sessionId del agente — mismo diagnóstico que nuestro buglog (`worker-token-cap-cwd-contamination`), incidente idéntico (~65,7M tokens del cwd-slug compartido). Ya NO hace falta fix local ni issue upstream.
- Archivos MODIFICADOS: merge de origin/main (`31ac125`, v0.4.5) → 6 conflictos resueltos:
  - `package.json`: scripts de upstream (`test:focused` = glob) + `overrides` de upstream; deps LOCALES preservadas (Electron ^43, vite ^7…). `package-lock.json` regenerado con `npm install`.
  - `src/main/index.ts`, `src/main/hooks.ts`, `src/preload/index.ts`, `src/renderer/src/hooks/useHive.ts`, `usePtyParser.ts`: adoptado upstream wholesale — retirado nuestro subsistema #162 (inboxWake) y la forma shared de #161 (ansiText) de la rama de integración (siguen intactos en sus branches `fix/*`).
- Archivos ELIMINADOS: `src/main/inboxWake.ts`, `test/inbox-wake.test.cjs`, `src/shared/ansiText.ts` (sustituidos por `src/main/workerWake.ts` + `src/renderer/src/components/ansiText.ts` de upstream).
- Resultado: `src/` + `test/` = **100% idénticos a upstream v0.4.5**; delta local = deps + docs/handoffs.
- Context7 usado: no (merge git + código propio del repo, sin API nueva de terceros)
- Decisiones técnicas: un solo motor de wake (el de upstream) para evitar nudges duplicados; política de deps locales mantenida.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` (node+web), `npm run test:focused` (= suite completa ahora), boot real `npm run dev`
- Comandos probados: typecheck limpio; **552/552 tests pass** (suite creció de 307 a 552 con v0.4.5); boot Electron con vite 7.3.6: broker (57547) + telemetry (57548) up, migración de huérfanos normal, keep-awake ON, cero errores nuevos (solo ruido conocido trust_store_mac). Lockfile verificado: electron 43.4.1, vite 7.3.6, better-sqlite3 13.0.3.
- Resultados obtenidos: EXITOSO
- Problemas encontrados: ninguno tras la resolución de conflictos
- Reparaciones realizadas: n/a
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: branches `fix/*` (estado exacto de los PRs abiertos #156/#160/#161/#162 hasta que el maintainer los cierre)
- COMPLETAR: (a) recomendar/aplicar `defaultWorkerTokenCap: 0` en `~/Library/Application Support/munder-difflin/config.json` — el fix upstream corrige la atribución, pero el cap sigue sumando cacheRead y 150k es demasiado bajo (decisión del usuario); (b) opcional: comentar en #160/#161/#162 que upstream ya cubre el contenido, o esperar a que el maintainer los cierre
- CUIDADO CON: en futuros merges, deps de package.json SIEMPRE locales (upstream sigue en Electron 32); `test:focused` ahora es glob — cualquier test nuevo corre automáticamente
- TESTEAR INMEDIATAMENTE: nada pendiente; si se abre la app con el hive del usuario, vigilar que el nuevo workerWake de upstream no moleste (nudge cada ≥60s por worker idle con inbox sin drenar)

## 📦 COMMIT REALIZADO
```
git commit -m "merge: upstream v0.4.5 (31ac125) — 4 PRs nuestros mergeados (#157 #158 #159 #178), roster-guard (#156) cherry-pickeado upstream, adopción workerWake/ansiText upstream sobre nuestras formas #161/#162, fix upstream del bug token-cap (06879a3) - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: 1275db5
