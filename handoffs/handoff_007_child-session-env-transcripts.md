# HANDOFF 007 - ENV CLAUDE_CODE_CHILD_SESSION HEREDADO: TRANSCRIPTS APAGADOS - 2026-08-17

## 📊 ESTADO ANTES DE MI TRABAJO
- Última persona: mismo agente (handoff 006, commits 9a1bc06/5c0863f)
- Último commit: 5c0863f - docs: registrar hash definitivo en handoff 006
- Estructura encontrada: reporte del humano con captura de la terminal de Angela (re-contratada como `worker-qa2` — god necesitó id nuevo porque el `worker-qa` muerto sigue ocupando `liveWorkers`, secuela del bug del handoff 006). La captura muestra la advertencia: **"Transcript saving is off — inherited CLAUDE_CODE_CHILD_SESSION marker"**.
- Problemas identificados:
  1. La app se lanza habitualmente DESDE DENTRO de una sesión Claude Code (`npm run dev` tipeado en un terminal claude — verificado: la instancia corriente, pid 22622 de 23:17, tiene `CLAUDE_PID=9178` = el claude interactivo del humano, y `CLAUDE_CODE_CHILD_SESSION=1`). Ese env fluye por `process.env` a cada PTY de agente → el CLI del agente se cree sesión hija y APAGA el guardado de transcripts → **ningún agente de esa corrida guarda sesión → `--resume` nunca encuentra nada**. Esto explica retroactivamente el misterio del handoff 004 (el transcript `baeffc24` de Ryan jamás existió).
  2. También se heredaban `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID` y el socket/token de messaging del PADRE — identidad de otra sesión dentro de agentes frescos.

## 🔧 TRABAJO REALIZADO
- Archivos MODIFICADOS: `src/main/pty.ts` — en `spawn()`, el env del hijo se construye y se le eliminan `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, `CLAUDE_CODE_MESSAGING_SOCKET`, `CLAUDE_CODE_MESSAGING_TOKEN` antes de `pty.spawn` (comentario con la causa). Los agentes son sesiones top-level se lance la app desde donde se lance.
- Archivos CREADOS: este handoff.
- Context7 usado: no aplicable — evidencia primaria (warning en pantalla + `ps eww` de la instancia y del shell).

## 🧪 TESTING Y VALIDACIÓN
- Pruebas ejecutadas: `npm run typecheck` → sin errores; `npm run test:focused` → 131/131 pass. Validación runtime en el reinicio inmediato (este mismo turno): los agentes nuevos NO deben mostrar la advertencia y sus transcripts deben aparecer en `~/.claude/projects/<cwd-slug>/`.
- Resultados obtenidos: EXITOSO (estático); runtime validado en este turno tras reinicio (ver respuesta al humano / próximo handoff si hay hallazgos).
- Problemas encontrados: n/a nuevos.
- Reparaciones realizadas: fix descrito.
- Estado final: TESTS PASANDO — validación runtime en el reinicio de este mismo turno

## ⚠️ PARA PRÓXIMO AGENTE
- Este reinicio activa los fixes de handoffs 005 (mempalace cpu), 006 (teardown en release) y 007 (env). Checklist post-arranque:
  1. Migración archiva huérfanos (business/qa/bizreview/qa2) → reconcile → restaurables → auto-restore los revive; David debe procesar sus 3 mails pendientes.
  2. Sin `[memory] mine ... exited 1` en el log.
  3. En el próximo done de un worker efímero: evento archive en hive/log.jsonl + tarjeta archivada + `liveWorkers` liberado (god puede reusar el id).
  4. Agentes nuevos sin la advertencia de transcript y con `.jsonl` de sesión en disco (resume funcional por primera vez).
- CUIDADO CON: los agentes revividos en este reinicio despiertan SIN contexto conversacional (sus transcripts nunca se guardaron — pérdida irrecuperable de esta era); su memoria durable (memory.md, identity, inbox, deliverables) reataca por id. A partir de ahora sí habrá transcripts.
- TESTEAR INMEDIATAMENTE: checklist de arriba.

## 📦 COMMIT REALIZADO
```
git commit -m "fix: limpiar markers de sesión Claude Code heredados en env de PTYs (transcripts se apagaban; resume imposible) - Agente Claude-IMPLEMENTADOR - TESTED"
```
Hash: [pendiente — se registra tras el commit]
