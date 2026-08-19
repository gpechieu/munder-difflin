# HANDOFF 010 - REVIEW UPSTREAM ATENDIDO: 7 PRs REBASADOS+CORREGIDOS, RESPUESTAS PUBLICADAS, PR #178 NUEVO - 2026-08-19

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo flujo de agentes (handoff 009, commits 030dfaa/8fd2f53/aec3220)
- Último commit: aec3220 - docs: registrar hash definitivo en handoff 009
- Estructura encontrada: el maintainer upstream (**chaitanyagiri**) revisó los 7 PRs (#156-#162) el 18-19 ago en una sola pasada. TODAS las reviews favorables, cero merges. Pedidos comunes: rebase (main avanzó 40 commits, 258 tests), hunk stale de `test:focused` en package.json (6 PRs de varios autores), tests faltantes. Nos encontró 2 bugs reales que se nos escaparon: `workers:stop` sin `teardownPty` (#159) y el hung-turn invisible del watchdog (#162) — ambos verificados como ciertos contra nuestro código antes de actuar.

## 🔧 TRABAJO REALIZADO
Pasada completa en worktree aislado (`git worktree` sobre origin/main 92461ab + `npm ci` con el lockfile del upstream — matriz real, no la nuestra). Por PR (branch → commit nuevo en fork):
- **#156** (roster guard) → `ed8bc84`: rebase limpio + 1 frase de comentario respondiendo su pregunta de diseño (RosterStore es singleton del main process — verificado `index.ts:3106` — el guard NO se re-arma con reload del renderer). **259/259**.
- **#157** (env markers) → `eca75c4`: adoptado su prefix-strip `/^CLAUDE(CODE|_)/` CON refinamiento propio: keep-list config-no-identidad (`CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_OAUTH_TOKEN`, `USE_BEDROCK/VERTEX`); orden arreglado (strip SOLO a la capa heredada — su bug del delete post-spread era real); todo extraído a `src/main/ptyEnv.ts` puro (`buildPtyEnv(parentEnv, userPath, agentEnv, platform)`) preservando el bloque locale de main; `test/pty-env.test.cjs` (7 tests, los 12 markers de su dump). **265/265**.
- **#158** (mempalace NaN) → `70092b6`: escape hatch (env explícito del usuario gana, `=coreml` queda como repro); **hallazgo que decide el scope**: chromadb PODA CoreML incondicionalmente para minilm (`onnx_mini_lm_l6_v2.py:244-249`) ⇒ minilm nunca corrió en CoreML ⇒ el pin macOS-wide es gratis y solo afecta al path roto (embeddinggemma). Helper puro `mempalaceDevice(platform, envOverride)` + `test/mempalace-device.test.cjs`. Body del PR actualizado (no-reindex). **262/262**.
- **#159** (worker lifecycle) → `51332ab`: (a) `teardownPty` añadido al 4º kill site `workers:stop` + doc-comment corregido + regla documentada en el header de `teardownPty`; (b) `tokenizeCommand` movido a `src/shared/commandLine.ts` (renderer re-exporta desde store/config, 5 importers intactos) + `buildWorkerLaunch()` puro en `src/main/workerLaunch.ts` (tokenize + autoMode + dedupe --model); (c) `test/worker-launch.test.cjs` (9 tests: sus 4+2 pedidos y más). **267/267**.
- **#178 NUEVO** (`fix/god-worker-floor-cards` → `aa50aa7`): el fix 4 (tarjetas visibles) SEPARADO como pidió — apilado sobre #159 (su archive depende de los teardown explícitos). Pregunta de restore respondida en código: `liveWorkers.set` tiene UN call site ⇒ un worker restaurado revive como agente normal sin reaping ("ephemerality is a property of the hiring, not of the card" — ahora comentario en el código).
- **#160** (tilde) → `3a879c5`: branch REESCRITO desde main (2 de 3 seams ya arreglados allá): queda `config:changeHome` con expandTilde (el seam vivo que solo nosotros cubrimos) + su sugerencia "better shape" adoptada: `readConfig` normaliza `harnessHome`/`recentHives` EN LECTURA (display + click de una vez, dedupe tilde/absoluto); test con stub electron en require.cache (patrón hive-roster-injection). Body actualizado. **261/261**.
- **#161** (ANSI bubbles) → `0a4c4b0`: módulo movido a `src/shared/ansiText.ts`; carry-over buffer INTEGRADO (no follow-up): `splitTrailingPartialEscape` acotado a `MAX_ESC_CARRY=64` en usePtyParser — escapes partidos entre chunks del PTY ya no leakan como texto; orden de regexes documentado como load-bearing; asimetría cursor-back documentada; `MAX_CUF_SPACES` nombrado. Su Q2 verificada: usePtyParser es el ÚNICO scraper (barrido \x1b en ambos procesos). **269/269** (11 tests ansi).
- **#162** (inbox-wake) → `8fc3d25`: gap hung-turn CERRADO con su shape (`HOOK_STALE_MS=5min`, silencio pty largo overridea hook stuck-busy) + 2 tests (override + tool call largo protegido); fires llevan `inboxIds` (main absorbió el PR #130 → dedup por Set: sincronizar solo newestId sub-sincronizaba); log etiquetado `(hook)/(pty)`; latencia ~90s documentada; `hookServer.forget()` en teardownPty prunea activity+contextById+transcriptPaths. Conflictos useHive.ts resueltos conservando la versión Set de main + `INBOX_NUDGE` compartido. **267/267** (9 tests).
- **Respuestas publicadas**: 1 comment por PR (7 total) respondiendo TODAS sus preguntas con evidencia; PR #178 creado; bodies de #158/#160 actualizados. Comment adicional en #156 con datapoint propio de backup-retention (579 files/2.9MB vs sus 6413/153MB).
- Archivos MODIFICADOS del repo local: solo este handoff + CLAUDE.md (los cambios de código viven en los PR branches del fork).
- Context7 usado: no aplicable — review response sobre código propio; verificaciones contra fuentes instaladas (mempalace 3.7.1, chromadb bundled) y dump vivo de sesión.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: por CADA branch, `npm run typecheck` + suite COMPLETA `node --test test/*.test.cjs` en worktree con deps del upstream (npm ci del lockfile de main): 259/265/262/267/267/261/269/267 — todo verde (main solo = 258).
- Comandos probados: experimento minilm/CoreML decidido leyendo fuente instalada (chromadb poda CoreML → no hacía falta correr embedding); dump `env | grep ^CLAUDE` de sesión viva (9 markers, todos matchean el prefijo).
- Resultados obtenidos: EXITOSO — 8 branches pusheados al fork, 7 comments + 1 PR nuevo publicados.
- Problemas encontrados: (1) main ya había absorbido el PR #130 (dedup Set en effect #3) → el sync del handler 3c se adaptó a esa forma (payload con inboxIds); (2) test 5 de inbox-wake cambiaba de semántica con el override → reescrito como caso protegido + caso hung-turn nuevo.
- Reparaciones realizadas: las anteriores, en el mismo pase.
- Estado final: TESTS PASANDO (por branch, matriz upstream; el repo local no cambió de comportamiento)

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: los branches `fix/*` locales (recién reescritos = estado exacto de los PRs). El worktree temporal ya fue removido (`git worktree prune` hecho).
- COMPLETAR: (a) monitorear respuestas del maintainer (quedan 2 decisiones SUYAS: workers visibles #178 y sign-off autoMode/Slack; y su respuesta sobre bounded-retry en #162 — ofrecimos implementarlo); (b) si pide el retry-bounded en #162: state ya tiene la forma (`{newestId, at}` → añadir `attempts`, escalar a god a los N); (c) **al mergear upstream: adoptar localmente las formas revisadas** — el feature branch local aún lleva las versiones VIEJAS (pin mempalace incondicional, lista de 5 markers, tokenizer duplicado, sin hung-turn override, ansiText en components/) — NO dejar divergir; (d) filar el bug upstream a mempalace (accelerator-loaded-but-NaN → mismo fallback que accelerator-unavailable; framing acordado con el maintainer); (e) pendientes heredados (npm audit, merges locales).
- CUIDADO CON: el fork tiene 8 branches; #178 está APILADO sobre #159 (si #159 cambia, rebasar #178). Los PRs ajenos #165 (tilde) y #130 (ya mergeado) interactúan con #160/#162 — coordinación ofrecida al maintainer.
- TESTEAR INMEDIATAMENTE: nada en el repo local (no cambió). Si se relanza la app, comportamiento idéntico al handoff 009.

## 📦 COMMIT REALIZADO
```
git commit -m "docs: handoff 010 - review upstream atendido: 7 PRs rebasados+corregidos, PR #178 nuevo, respuestas publicadas - Agente Claude-REVIEWER"
```
Hash: a48e728
Branches fork: #156 ed8bc84 · #157 eca75c4 · #158 70092b6 · #159 51332ab · #160 3a879c5 · #161 0a4c4b0 · #162 8fc3d25 · #178 aa50aa7
