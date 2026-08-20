# HANDOFF 013 - DOGFOODING 3H MONITORIZADO: BUG UPSTREAM TOKEN-CAP MATA GOD-WORKERS EN 1,5s - 2026-08-20

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-IMPLEMENTADOR (handoff 012, merge e64c543 + docs 24b4b40/ef713a9)
- Último commit: ef713a9 - docs: registrar hash definitivo en handoff 012
- Estructura encontrada: feature branch alineado con upstream v0.4.4 + 8 PRs post-review; el usuario pidió abrir la app y monitorearla en 2º plano durante su sesión de pruebas.
- Problemas identificados durante el monitoreo: ver TRABAJO REALIZADO (1 bug upstream nuevo + 2 gotchas de infraestructura del harness de monitoreo).

## 🔧 TRABAJO REALIZADO
- **Infra de monitoreo**: app lanzada en background con doble-fork + Monitor persistente del log (filtro de ruido de certificados) + watcher de PID. Incidente intermedio: el wrapper `npm run dev` vía run_in_background murió solo dejando Electron huérfano con el dev server 5173 caído → reinicio con el patrón robusto. Gotcha zsh descubierto: variables sin comillas no se dividen → `kill $PIDS` era no-op (fix: xargs). Ambos loggeados en `.wolf/buglog.json`.
- **Sesión de prueba del usuario (18:09–21:10)**: god (opus-4-8[1m]) + 6 empleados (dwight/jim/pam/kelly/darryl/angela) en hive `NEUS_Headquarters`. Lock de pantalla ~27 min → unlock re-armó scheduler/beats/router/keep-awake con 7/7 PTYs sanos. Cero errores no-conocidos en 3h de log.
- **BUG UPSTREAM CAZADO EN VIVO** (`worker-token-cap-cwd-contamination` en buglog): 2 god-workers (splynx-data 19:52 cap 2M, splynx-relev 19:54 SIN cap) muertos en ~1,5s (spawn→reap 1.485/1.463ms, primer tick del reaper), outbox vacío, tarea Splynx perdida 2 veces. Causa: `telemetry.ts transcriptFallback` → `readAgentUsage(cwd)` atribuye al worker recién nacido el ACUMULADO HISTÓRICO del cwd-slug compartido (~72M tokens; evidencia: ambos workers ~mismo conteo). Agravantes: `defaultWorkerTokenCap:150000` en config aplica a toda contratación (god adaptó quitando el cap y murió igual), y el cap suma cacheRead. Atribución git verificada: commits upstream fd05989 (seam 7A) + d670856 (wiring P4), ambos en upstream main — NO es de nuestros PRs, reproducible en stock v0.4.4.
- Descubierto además: harnessHome actual = `NEUS_Headquarters` (ya no `Oficina_Neus`) → CLAUDE.md corregido y commiteado (cfbce5b, quirúrgico preservando el header OpenWolf sin commitear).
- Archivos MODIFICADOS: CLAUDE.md (cfbce5b), .wolf/{STATUS.md,cerebrum.md,buglog.json,memory.md} (untracked a propósito). CREADOS: este handoff.
- Context7 usado: no aplicable (monitoreo + diagnóstico de código propio/upstream ya en el árbol).

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: sesión real de 3h de la app con monitoreo continuo; diagnóstico verificado leyendo el código (telemetry.ts:389, index.ts:4459/4545), el hive log con timestamps, los spawn-requests archivados (.done, caps reales) y la config; atribución por git merge-base.
- Comandos probados: monitor tail+grep, watcher kill -0, timeline de hive/log.jsonl, cierre limpio de app (0 procesos residuales).
- Resultados obtenidos: EXITOSO como prueba de estabilidad (merge de handoff 012 sólido en uso real); el bug encontrado es de upstream y quedó SIN ARREGLAR a propósito (usuario no eligió opción aún).
- Problemas encontrados y reparados: wrapper muerto/monitor ciego (relanzado robusto), kills no-op por zsh (xargs). Sin reparar: el bug del token cap (pendiente decisión).
- Estado final: FUNCIONANDO CORRECTAMENTE (la app y el harness; el token cap de workers = REQUIERE ATENCIÓN, upstream)

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: branches `fix/*` e `integration/upstream-8-fixes` (referencias de PRs); el header OpenWolf de CLAUDE.md sigue sin commitear a propósito.
- COMPLETAR (usuario debe elegir): (a) workaround `defaultWorkerTokenCap: 0` en config.json del harness; (b) fix local baseline-delta (snapshot `workerTokensUsed` al spawn en `processSpawnRequest`, reap por delta en `ephemeralWorkerTick`) + test; (c) issue upstream (4º) con la evidencia del buglog, opcional PR #9. Además: monitorear las 3 decisiones del maintainer (#178 visibilidad, autoMode/Slack, bounded-retry #162) y pendientes heredados (bug report mempalace, npm audit).
- CUIDADO CON: la shell del harness es zsh (kills con xargs); lanzar la app en background SOLO con doble-fork `(npm run dev >> log 2>&1 &)`; harnessHome = NEUS_Headquarters.
- TESTEAR INMEDIATAMENTE: si se hace el fix (b), probar contratación god-worker en un cwd con historia larga de transcripts — antes del fix muere en 1,5s, después debe vivir.

## 📦 COMMIT REALIZADO
```
git commit -m "docs: handoff 013 - dogfooding 3h: harness estable, bug upstream token-cap workers diagnosticado (muerte en 1,5s por transcriptFallback por cwd) - Agente Claude-TESTER"
```
Hash: [PENDIENTE] (+ cfbce5b docs CLAUDE.md previo)
