# HANDOFF 005 - MEMPALACE: NaN EMBEDDINGS POR COREML → FORZAR CPU - 2026-08-16

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo agente (handoff 004, commit 2053a98)
- Último commit: 2053a98 - docs: validación runtime completada en handoff 004
- Estructura encontrada: branch `feature/god-workers-visibles-roster-guard`; app dev sana; único error recurrente en logs: `[memory] mine <agente> exited 1 ... chromadb: Embeddings must not contain NaN or Infinity values` (33 fallos, TODOS los agentes, TODOS los ciclos de 3 min) → la memoria semántica compartida no se indexaba en absoluto.

## 🔧 TRABAJO REALIZADO
- Archivos MODIFICADOS: `src/main/memory.ts` — nueva constante `MEMPALACE_DEVICE = 'cpu'` (con comentario de causa) añadida como `MEMPALACE_EMBEDDING_DEVICE` en `env()` (agentes: su `mempalace search`/`wake-up` embebe queries) y `childEnv()` (mine loop).
- Archivos CREADOS: este handoff.
- Context7 usado: no aplicable — diagnóstico empírico sobre el paquete instalado (mempalace v3.7.1 vía uv, herramienta externa sin repo local).
- Decisiones técnicas — CADENA DE DIAGNÓSTICO (reproducible):
  1. El modelo del palace es `embeddinggemma` (ONNX cuantizado, `palace/mempalace_embedder.json`).
  2. Embedder directo en Python con provider CPU → vectores perfectos (corpus completo de 151 archivos, individual y en batch). Descartado: modelo corrupto, documento patológico, efecto batch.
  3. `mempalace mine` manual reveló `Device: coreml` → mempalace con `embedding_device=auto` elige CoreMLExecutionProvider en Apple Silicon.
  4. **Reproducción determinante**: `EmbeddinggemmaONNX(preferred_providers=["CoreMLExecutionProvider",...])` → NaN para TODO input (hasta "hello world"); mismo input con CPU → limpio. CoreML ejecuta el grafo partido (330/1647 nodos) y sus particiones fp16 desbordan.
  5. Palanca: env `MEMPALACE_EMBEDDING_DEVICE` (> `embedding_device` en config.json > "auto").
- OJO al correr `mempalace` a mano: exportar TAMBIÉN `MEMPALACE_EMBEDDING_MODEL=embeddinggemma`, si no el identity-check corta con `EmbedderIdentityMismatchError` (el default es minilm).

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas:
  - `npm run typecheck` → sin errores; `npm run test:focused` → 131/131 pass.
  - `mempalace mine` con `MEMPALACE_EMBEDDING_DEVICE=cpu` para god → 19/19 archivos, 77 drawers (antes: 0/19, abort).
  - Catch-up manual de TODOS los agentes con cpu: worker-marketing 205 drawers, worker-business 103, worker-bizreview 96, worker-qa 65, smoke×2 50 c/u → palace completo (~646 drawers).
  - Recall real: `mempalace search "marketing plan Oficina Neus"` → resultados correctos (cosine 0.809, BUSINESS_PLAN.md / MARKETING_BASELINE_90DAY_PLAN.md).
- Resultados obtenidos: EXITOSO
- Problemas encontrados: el lock del palace compite con el mine loop de la app (reintentos con espera resolvieron).
- Reparaciones realizadas: además del fix de código, catch-up manual completo del palace (valor inmediato sin esperar reinicio).
- Estado final: FUNCIONANDO CORRECTAMENTE

## ⚠️ PARA PRÓXIMO AGENTE
- NO TOCAR: `palace/` a mano; siempre vía CLI de mempalace y con los 3 env vars correctos.
- COMPLETAR: el fix de código activa en el PRÓXIMO reinicio de la app (la instancia corriente sigue con CoreML y su loop sigue fallando inofensivamente; el contenido ya indexado no se pierde — solo cambios nuevos quedan sin indexar hasta reiniciar). Tras el reinicio, verificar que desaparezcan los `[memory] mine ... exited 1`. Considerar reportar el bug upstream a mempalace (CoreML+embeddinggemma cuantizado ⇒ NaN; debería guardear NaN o desaconsejar coreml para ese modelo).
- CUIDADO CON: los agentes YA corriendo conservan el env viejo (sin device) hasta su respawn — su `mempalace search` puede seguir devolviendo basura/NaN hasta entonces.
- TESTEAR INMEDIATAMENTE tras reinicio: log sin errores de memory + un `mempalace search` desde un agente nuevo.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: forzar MEMPALACE_EMBEDDING_DEVICE=cpu (CoreML produce NaN con embeddinggemma cuantizado; memoria semántica no se indexaba) - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: c4258bc
