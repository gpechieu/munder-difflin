# HANDOFF 004 - SPAWN-REQUESTS: TOKENIZAR COMANDO + HEREDAR AUTOMODE - 2026-08-16

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo agente (handoff 003, commits eb366b0/d2e73a0)
- Último commit: d2e73a0 - docs: registrar hash definitivo en handoff 003
- Estructura encontrada: branch `feature/god-workers-visibles-roster-guard`; app dev corriendo con Ryan restaurado trabajando.
- Problemas identificados (reporte humano: "el agente nuevo pide permisos para todo"):
  1. Ryan restaurado corre `claude` SIN `--permission-mode bypassPermissions` (verificado con `ps`): la receta de restore inyectada en handoff 003 llevaba `command:'claude'` pelado. Con `config.autoMode=true`, el resto de la app añade el bypass vía `buildSpawnCommand`.
  2. **Bug raíz encontrado investigando lo anterior**: `processSpawnRequest` pasaba el `command` del request COMPLETO (p.ej. `claude --model claude-sonnet-5 --permission-mode bypassPermissions`) como `command` de `AgentSpawnOptions`, pero la capa PTY (`resolveCommand` en `pty.ts`) lo trata como UN nombre de ejecutable → node-pty intenta exec de un binario llamado como toda la línea → ENOENT → worker muere en <1s y el request queda `.done`. Evidencia en `hive/log.jsonl`: spawn v3 de Ryan (con flags) archivado a los 708ms; smoke test (con flags) a los 904ms; los spawns con `claude` pelado vivieron. Reproducción externa: el mismo comando funciona en shell → el fallo era exclusivo del paso de spawn.

## 🔧 TRABAJO REALIZADO
- Archivos MODIFICADOS: `src/main/index.ts` (`processSpawnRequest`):
  1. Tokeniza `command` (mismas reglas de comillas que `tokenizeCommand` del renderer) → `command: bin, args: [...flags]`. Evita duplicar `--model` si el request trae campo `model` y la línea ya lo incluye (spawnAgentCore ya salta su inyección de defaultModel si argv trae `--model`).
  2. Si `config.autoMode` está activo, el comando claude de un request SIN `--permission-mode` propio hereda ` --permission-mode bypassPermissions` (un worker headless sin bypass se cuelga en el primer prompt hasta que el reaper lo mata; un `--permission-mode` explícito del request siempre gana).
  3. El broadcast `hive:agentSpawned` sigue llevando la línea completa → el roster persiste el comando correcto para futuros restores.
- Archivos CREADOS: este handoff.
- Context7 usado: no aplicable — diagnóstico sobre fuentes primarias (hive/log.jsonl, ps del proceso vivo, pty.ts).
- Decisiones técnicas: heredar autoMode replica la semántica de `buildSpawnCommand` del renderer (flag de auto-modo por proveedor); se limita a comandos claude para no inventar flags de otros providers en main.

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` → sin errores; `npm run test:focused` → 131/131 pass. Reproducción del diagnóstico: `claude --settings <worker settings> --permission-mode bypassPermissions -p "ok"` funciona en shell (descarta settings/bypass como causa); cronología de muertes en hive/log.jsonl correlaciona 100% con "flags embebidos en command".
- Resultados obtenidos: EXITOSO (estático + runtime). Validación runtime completada tras cierre de app por el humano (~21:10 UTC):
  1. Roster de Ryan corregido con app cerrada (`command: claude --model claude-sonnet-5 --permission-mode bypassPermissions`, `model: claude-sonnet-5`).
  2. Relanzada `npm run dev` con el código nuevo → Ryan auto-restaurado; su proceso vivo verificado con `ps`: lleva `--model claude-sonnet-5` y `--permission-mode bypassPermissions` (ya no pide permisos).
  3. Smoke request `smoke2` CON flags en `command` → el worker VIVIÓ: evento `session` 1s tras el spawn (ts 1786915058282) y mensaje `act:"done"` a los 22s (ts 1786915079678). Antes un request idéntico moría en <1s sin sesión. Fix confirmado con spawn real.
- Problemas encontrados: ninguno nuevo.
- Reparaciones realizadas: n/a.
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: `roster-backups/`.
- COMPLETAR: pendientes heredados del handoff 003 (muerte del miner mempalace por NaN embeddings; borrar cards/residuos `worker-smoke`/`worker-smoke2` desde la UI si molestan; merge de branches; npm audit).
- CUIDADO CON: no matar la app mientras un agente esté a mitad de tarea (pierde el turno en curso; el resume recupera contexto pero no el trabajo no guardado); editar `roster.json` SOLO con la app cerrada.
- TESTEAR INMEDIATAMENTE: nada crítico — flujo god→worker validado end-to-end con spawn real.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: tokenizar command de spawn-requests (workers con flags morían con ENOENT en <1s) y heredar autoMode (bypass) en workers de god - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: 441060f
