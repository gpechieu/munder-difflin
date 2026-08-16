# HANDOFF 006 - RELEASE DE WORKERS SIN TEARDOWN (TARJETAS CONGELADAS) - 2026-08-16

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo agente (handoff 005, commits c4258bc/153b95d/a4ddcb4)
- Último commit: a4ddcb4 - docs: actualizar gotcha mempalace en CLAUDE.md
- Estructura encontrada: reporte del humano: "DAVID y ANGELA se han trabado". David = `worker-business`, Angela = `worker-qa` (+ Oscar = `worker-bizreview`), contratados por god esta noche vía spawn-requests (el fix del handoff 004 funcionando).
- Problemas identificados (cadena de evidencia):
  1. Los tres TERMINARON su trabajo y enviaron `act:"done"` a god (outbox/.sent: "Business plan delivered — BUSINESS_PLAN.md", "QA review complete", ~23:32-23:33). El dev log muestra `[worker] <id> signaled done — releasing` para los tres → kill por diseño (workers efímeros). Verificado con `ps`: sus procesos claude no existen.
  2. PERO no hay NINGÚN evento `archive` en hive/log.jsonl para ellos, registry `archived:false`, y sus tarjetas siguen en `agents[]` del roster → en el piso se ven como agentes activos congelados ("trabados"). Además god siguió mandándoles trabajo al inbox después de muertos (David: 3 mensajes pendientes 23:43-23:50 que nadie leerá).

## 🔧 TRABAJO REALIZADO
- CAUSA RAÍZ (fundamentada en código): `ptyManager.kill()` (pty.ts:428-440) hace `sessions.delete(id)` SINCRÓNICO; el `onExit` de node-pty llega después y muere en el guard de identidad (pty.ts:378 `if (sessions.get(id) !== session) return`) → el exit handler global (index.ts:530 → `teardownPty`) NUNCA corre para un PTY matado explícitamente. Todos los demás kill sites llaman `teardownPty` explícito tras el kill (voice kill, pty:kill IPC, breaker stop) — por eso los restarts de Ryan desde la UI sí se archivaron. El ÚNICO camino que confiaba en onExit era el release/reap de workers efímeros (el comentario "`releasing` guards the gap before onExit fires" documentaba la creencia falsa). smoke1 se archivó bien porque murió SOLO (ENOENT, exit natural → onExit sí corre); el archive de smoke2 coincide con acciones de UI del humano (~23:17-23:19), no con el release.
- Archivos MODIFICADOS: `src/main/index.ts` — (a) `teardownPty(workerId)` explícito tras `ptyManager.kill(workerId)` en los 3 sitios del tick (done-release, token-cap reap, idle reap) con comentario de causa; (b) corregido el doc-comment de `teardownPty` que afirmaba "kill() also makes node-pty fire onExit" (falso) — ahora documenta que TODO kill site debe llamar teardownPty él mismo.
- Archivos CREADOS: este handoff.
- Context7 usado: no aplicable — diagnóstico sobre fuentes primarias (hive/log.jsonl, ps, outbox/.sent, pty.ts).

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` → sin errores; `npm run test:focused` → 131/131 pass. Validación runtime del camino completo requiere reinicio (instancia corriente con código viejo) — el mismo smoke-con-done del handoff 003/004 sirve de test: tras el reinicio, un worker que haga done debe generar evento archive en hive/log.jsonl y tarjeta archivada.
- Resultados obtenidos: EXITOSO (estático)
- Problemas encontrados: n/a nuevos.
- Reparaciones realizadas: fix descrito.
- Estado final: TESTS PASANDO — validación runtime del release completo pendiente del próximo reinicio

## ⚠️ PARA PRÓXIMO AGENTE
- COMPLETAR en el próximo reinicio de app (activa TAMBIÉN los fixes de handoff 005 y este):
  1. Al arrancar, reconcile convertirá a David/Angela/Oscar (tarjetas muertas en agents[]) en RESTAURABLES y el auto-restore los revivirá con resume → leerán su inbox pendiente (David tiene los fixes de QA + decisiones del humano esperando) y seguirán como empleados normales del piso (ya no efímeros: el restore no los registra en liveWorkers → sin reaper).
  2. Verificar: log sin `[memory] mine ... exited 1`; y en el siguiente done de un worker efímero, evento archive + tarjeta archivada.
- CUIDADO CON: los 3 mensajes pendientes en inbox de worker-business son trabajo REAL que god espera — no vaciarlos; el revive los procesa.
- TESTEAR INMEDIATAMENTE: los 2 puntos de COMPLETAR.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: teardownPty explícito tras kill en release/reap de workers (kill() no dispara onExit; tarjetas quedaban congeladas y god maileaba agentes muertos) - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: [pendiente — se registra tras el commit]
