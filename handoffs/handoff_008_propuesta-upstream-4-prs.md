# HANDOFF 008 - PROPUESTA UPSTREAM: 4 PRs A chaitanyagiri/munder-difflin - 2026-08-17

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: Agente Claude-TESTER (handoff 007, commit 364dba5)
- Último commit: 364dba5 - docs: validación runtime completada en handoff 007
- Estructura encontrada: branch `feature/god-workers-visibles-roster-guard` limpio con los 5 fixes de código de handoffs 001-007. Upstream `origin` = chaitanyagiri/munder-difflin (permiso: READ), su main avanzó solo en docs (`6a09318`, placa Nº 010 en `docs/wall-data.json`) — ninguno de nuestros fixes existe allá.
- Pregunta del humano: ¿los arreglos fueron parches para su entorno o bugs legítimos del app? Si legítimos, proponerlos al repo.

## 🔧 TRABAJO REALIZADO
- **Veredicto fundamentado** (evidencia: diffs completos + handoffs 001-007):
  - LEGÍTIMOS Y UNIVERSALES (bugs de lógica del app, independientes del entorno): guard del roster que se desarmaba tras un rechazo (eb366b0); tokenización del command de spawn-requests + herencia de autoMode (441060f); teardownPty explícito tras kill() en release/reap (9a1bc06); limpieza de markers de sesión Claude heredados en env de PTYs (a2eb617 — descubierto por nuestro workflow pero afecta a cualquiera que lance la app desde un terminal claude).
  - LEGÍTIMO CON MATIZ: pin `MEMPALACE_EMBEDDING_DEVICE=cpu` (c4258bc) — bug real (CoreML+embeddinggemma cuantizado ⇒ NaN) pero el pin incondicional afecta a todas las plataformas; para upstream se propuso GATEADO a darwin (única plataforma con CoreML).
  - CAMBIO DE DISEÑO (no bug): workers de god visibles/restaurables — contradice el "headless-by-design" del upstream; se propuso igual, con la justificación (invisibles ⇒ irrestaurables y fallos silenciosos) y ofreciendo separarlo.
  - PARCHE PARA NOSOTROS (NO propuesto): bumps de package.json — Electron 32→43 etc. era upgrade personal del humano sin commitear; los agentes solo lo hicieron instalable (vite ^7, better-sqlite3 ^13). El main del upstream instala bien con sus pins. También excluidos: handoffs/, CLAUDE.md, fix de entorno del handoff 002.
- **Ejecución**: fork `gpechieu/munder-difflin` creado (`gh repo fork`); remote `fork` añadido; 4 branches limpios desde `origin/main` (6a09318) con el estado EXACTO testeado de cada archivo (checkout desde el feature branch), commits en inglés estilo upstream:
  1. `fix/roster-empty-guard-survives-refusal` (b63017d: roster.ts + test) → **PR #156**
  2. `fix/agent-env-inherited-claude-session` (7049fac: pty.ts) → **PR #157**
  3. `fix/mempalace-coreml-nan-embeddings` (0031e7d: memory.ts, ADAPTADO: `process.platform === 'darwin' ? 'cpu' : undefined` + spread condicional) → **PR #158**
  4. `fix/god-worker-spawn-lifecycle` (dabb009: index.ts completo, los 4 sub-fixes juntos con oferta de split) → **PR #159**
- Archivos MODIFICADOS del repo local: ninguno en este branch (solo este handoff). Los PR branches viven en el repo (git branch) y en el fork.
- Context7 usado: no aplicable — trabajo de git/gh sobre código ya escrito.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas EN CADA PR branch (worktrees temporales con node_modules compartido):
  - `npm run typecheck` → OK en los 4.
  - `npm run test:focused` → #156: 131/131 (incluye el test de regresión nuevo); #157/#158/#159: 130/130.
- Nota honesta: los tests corrieron con el node_modules local (Electron 43 / better-sqlite3 13); los cambios de código son agnósticos a deps, pero la matriz exacta del upstream (Electron 32) no se ejecutó localmente.
- Resultados obtenidos: EXITOSO — 4 PRs abiertos y verificados con URL.
- Problemas encontrados: ninguno.
- Estado final: FUNCIONANDO CORRECTAMENTE (PRs publicados; el repo local no cambió de comportamiento)

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: los 4 branches `fix/*` locales mientras los PRs estén abiertos (son la base para responder review; recrear worktree si piden cambios: `git worktree add <dir> <branch>`).
- COMPLETAR: (a) monitorear respuesta del maintainer en PRs #156-#159 y atender review; (b) si merge upstream, rebasar nuestro feature branch sobre el nuevo main y descartar los commits duplicados; (c) pendientes heredados: npm audit (handoff 001), merge local de branches cuando el humano apruebe; (d) opcional: reportar el bug CoreML+NaN a mempalace upstream (handoff 005 lo recomendaba).
- CUIDADO CON: el PR #158 difiere del código local (gate darwin vs pin incondicional) — si se mergea upstream, adoptar la versión gateada localmente para no divergir. El PR #159 incluye el cambio de diseño (workers visibles); el maintainer puede pedir separarlo — los sub-fixes 1-3 son separables del 4.
- TESTEAR INMEDIATAMENTE: nada — el repo local no cambió.

## 📦 COMMIT REALIZADO
```
git commit -m "docs: handoff 008 - propuesta upstream: 4 PRs (#156-#159) a chaitanyagiri/munder-difflin - Agente Claude-DOCUMENTADOR"
```
Hash: 91d6e67
