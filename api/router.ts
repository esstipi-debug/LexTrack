import { authRouter } from "./auth-router";
import { createRouter, publicQuery } from "./middleware";
import { ragRouter } from "./rag-router";
import { causaRouter } from "./causa-router";
import { alertaRouter } from "./alerta-router";
import { tareaRouter } from "./tarea-router";
import { checklistRouter } from "./checklist-router";
import { generadorRouter } from "./generador-router";
import { jurisprudenciaRouter } from "./jurisprudencia-router";
import { leykarinRouter } from "./leykarin-router";
import { honorarioRouter } from "./honorario-router";
import { diarioOficialRouter } from "./diariooficial-router";
import { agentRouter } from "./agent-router";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  rag: ragRouter,
  causa: causaRouter,
  alerta: alertaRouter,
  tarea: tareaRouter,
  checklist: checklistRouter,
  generador: generadorRouter,
  jurisprudencia: jurisprudenciaRouter,
  leykarin: leykarinRouter,
  honorario: honorarioRouter,
  diarioOficial: diarioOficialRouter,
  agent: agentRouter,
});

export type AppRouter = typeof appRouter;
