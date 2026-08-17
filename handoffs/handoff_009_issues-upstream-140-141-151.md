# HANDOFF 009 - ISSUES UPSTREAM #140/#141/#151: FIX + VALIDACIÓN RUNTIME + PRs #160-#162 - 2026-08-17

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo agente (handoff 008, commits 91d6e67/b09be3d — PRs #156-#159)
- Último commit: b09be3d - docs: registrar hash definitivo en handoff 008
- Estructura encontrada: 13 issues abiertos en upstream; bugs reales no cosméticos: **#151** (workers se cuelgan con mail en inbox — wake solo-renderer sin retry), **#141** (texto corrupto en thought bubbles), **#140** (`ENOENT: mkdir '~/HarnessAgents'` en onboarding). Ninguno arreglado en upstream ni cubierto por PRs abiertos, SALVO el bug secundario del #151 (dedup lexicográfico) que ya tiene PR #130 de un tercero — no se duplicó, se referenció.

## 🔧 TRABAJO REALIZADO
- **#140** — `expandTilde` en 3 seams: `ensureHarnessHome` (mkdir del wizard), `writeConfig` (ingesta de harnessHome, misma regla que registeredRepos), `config:changeHome` (resolve anclaría `~` al cwd). Archivos: `src/main/config.ts`, `src/main/index.ts`, `test/harness-home-tilde.test.cjs` (nuevo).
- **#141** — el parser del pty solo eliminaba SGR; el CLI repinta con cursor-forward (`ESC[nC` en lugar de espacios) y direccionamiento (`ESC[14;6H`). Nuevo `src/renderer/src/components/ansiText.ts`: `stripAnsi` traduce CUF→espacios (borrarlo fusionaría palabras) y elimina OSC/CSI/charset/escapes sueltos; `usePtyParser.ts` lo usa y colapsa runs de espacios en el summary. Test byte-exacto del screenshot del issue: `test/ansi-text.test.cjs`.
- **#151** — watchdog en MAIN espejo de `reengageGod`: `src/main/inboxWake.ts` (decisión pura, testeada) + beat always-on de 60s en index.ts + evento `hive:inboxWake` + handler renderer (effect 3c en `useHive.ts`) que re-conduce el camino guardeado normal (encola `INBOX_NUDGE` con dedup por contenido, reconcilia status 'working' wedged→idle, sincroniza dedup del effect #3; nunca pisa waiting/blocked/looping). **CLAVE ANTI-PARCHE**: el gate inicial "pty quieto 30s" fue FALSIFICADO en vivo (el TUI idle de claude repinta continuamente → idleFor≈0 siempre) y reemplazado por la señal de causa raíz: idle por HOOKS (`HookServer.hookIdleFor`: Stop/SessionStart=idle, resto=busy, Status ticks excluidos), pty-quiet solo como fallback para providers sin hooks. Archivos: `src/main/hooks.ts`, `src/main/inboxWake.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/hooks/useHive.ts`, `test/inbox-wake.test.cjs` (nuevo, 8 tests).
- `package.json`: 3 tests nuevos añadidos a `test:focused`.
- **PRs upstream** (fork gpechieu, branches limpios desde origin/main 6a09318): **#160** (fix/harness-home-tilde, 0ca0e8d), **#161** (fix/bubble-ansi-garble, a3b75f6), **#162** (fix/worker-inbox-wake-watchdog, 8c04534). Cada branch validado por separado: typecheck OK + 133/137/138 tests.
- Context7 usado: no aplicable — bugs de lógica interna diagnosticados sobre fuentes primarias (código, transcripts, logs, screenshots de los issues).

## 🧪 TESTING Y VALIDACIÓN
- Estático: `npm run typecheck` OK; `npm run test:focused` **149/149** en el branch de trabajo.
- **Runtime real (app Electron corriendo, CDP en :9222 para conducir el renderer)**:
  - **#140**: IPC real `config:ensureHome('~/md-issue140-live-test')` → `{ok:true}` + dir creado en `$HOME` expandido + cero dirs `~` literales. (Test dir eliminado después.)
  - **#151 E2E con workers reales** (haiku, cwd scratch, contratados por el flujo real de spawn-requests):
    1. Fire con renderer AUSENTE (launch picker abierto): `[inbox-wake] worker-test151: 2 undrained message(s), pty quiet 78s` — el caso irrecuperable del diseño viejo.
    2. Descubrimiento: TUI idle de claude repinta continuo (transcript demostró Stop a las 12:01:33 con pty "activo" minutos después) → rediseño a hook-idle.
    3. Con el fix hook-idle y tras restart+resume: `[inbox-wake] worker-test152: 1 undrained message(s), pty quiet 39s` — UN solo fire (retry suppression OK), y al despausar la entrega el nudge se tipeó y el worker movió TODO el inbox a `.done/` (verificado en filesystem + transcript). Nota: el delivery layer tipeó el nudge 2 veces con 12s de gap — retry-con-ack pre-existente (#113), acotado e inofensivo (el 2º turno encontró inbox vacío); el watchdog NO duplicó ni fire ni encolado.
  - **#141**: test unitario con los bytes exactos del screenshot del issue; visual en vivo: bubbles limpios durante actividad real del piso.
- Resultados obtenidos: EXITOSO
- Problemas encontrados y reparados: (1) gate pty-quiet inválido para claude TUI → señal por hooks (documentado arriba); (2) primer relaunch chocó con Electron huérfano en :9222 (single-instance) → kill y relaunch limpio.
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: branches `fix/harness-home-tilde`, `fix/bubble-ansi-garble`, `fix/worker-inbox-wake-watchdog` mientras los PRs #160-#162 estén abiertos (base para review).
- COMPLETAR: (a) monitorear PRs #156-#162 y atender review; (b) residuos de test inofensivos: dirs `hive/agents/worker-test151/` y `worker-test152/` en harnessHome (registry archived:true, sin tarjetas; los 2 mails de test151 quedaron sin drenar a propósito — agente archivado) — borrables desde la UI o a mano; (c) hallazgo abierto: `looksStuck()` y heurísticas que leen `ptyManager.idleFor` sufren el mismo problema del TUI que repinta — candidato a issue/PR aparte (anotado en el body del PR #162); (d) pendientes heredados (npm audit, merges locales).
- CUIDADO CON: la app quedó CERRADA (el usuario la relanza normal; auto-restore revive a god/Ryan/David/Angela/Oscar); roster.json editado a mano CON LA APP CERRADA (procedimiento documentado) solo para quitar la tarjeta de test.
- TESTEAR INMEDIATAMENTE: nada crítico — en el próximo uso normal, ver en el dev log algún `[inbox-wake]` solo cuando un agente idle tenga mail sin drenar.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: issues upstream #140 (tilde en harness home), #141 (ANSI en thought bubbles), #151 (watchdog inbox-wake de workers en main, idle por hooks) - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: 030dfaa
