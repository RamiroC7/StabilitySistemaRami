/**
 * Entrypoint de Vercel Node.js Serverless Function (T17 — "Alta del
 * proyecto de Vercel", parte de código). NO puede ser Edge: `resolve-bearer`
 * y el resto del Authorization Server usan `node:crypto`
 * (`createHash`/`randomBytes`), que no está disponible completo en el
 * runtime Edge.
 *
 * Vercel invoca las Node functions con la misma firma `(req, res)` de
 * `node:http` (`IncomingMessage`/`ServerResponse`) — por eso alcanza con
 * delegar directo a `handleRequest`, la misma lógica de ruteo que usa el
 * bootstrap local `src/http.ts`, sin duplicarla.
 *
 * Nota sobre `tsconfig.json`: este directorio queda AFUERA del `include` de
 * `packages/gym-owner-mcp/tsconfig.json` a propósito. Ese tsconfig tiene
 * `rootDir: "src"` (para que `npm run build` siga emitiendo `build/` tal
 * como lo hacía antes de T17); agregar `api/` ahí rompería `rootDir` o nos
 * obligaría a tocar `outDir`/`rootDir` del build existente. Vercel compila
 * `api/*.ts` con su propio builder (`@vercel/node`), independiente del
 * `tsc` de este paquete, así que no hace falta que este archivo esté en ese
 * `include` para que el deploy funcione.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleRequest } from "../src/request-handler.js";

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleRequest(req, res);
}
