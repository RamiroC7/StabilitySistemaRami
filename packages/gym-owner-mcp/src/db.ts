/**
 * Dos pools de `pg` a nivel de modulo (uno por rol Postgres) + helpers de query.
 *
 * A diferencia de `packages/mcp-server/src/db.ts` (proceso stdio efimero, un
 * solo pool), este server corre en Vercel (funciones serverless): cada
 * invocacion puede correr en un runtime distinto y varias invocaciones
 * concurrentes pueden compartir el mismo modulo cacheado, asi que el pool se
 * dimensiona un poco mas grande (`max: 3`) para tolerar esa concurrencia sin
 * agotar las conexiones del pooler de Supabase.
 *
 * - `gym_owner_readonly`: solo SELECT sobre `public` (datos del gym).
 * - `gym_mcp_service`: lectura/escritura solo sobre el schema `gym_mcp`
 *   (tokens OAuth + audit log). Nunca tiene acceso a `public`.
 *
 * Ver specs/gym-owner-mcp-vercel/design.md (Data model, Architecture).
 */
import pg from "pg";

const { Pool } = pg;

/**
 * Devuelve la password embebida en la connection string, si la hay, para poder
 * sanitizarla de los mensajes de error. `postgresql://user:PASSWORD@host/db`.
 */
function extractPassword(connString: string): string | null {
  try {
    const url = new URL(connString);
    return url.password ? decodeURIComponent(url.password) : null;
  } catch {
    return null;
  }
}

function requireEnv(name: string, roleHint: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Falta ${name}. Copiá packages/gym-owner-mcp/.env.example a .env y completá la connection string del rol ${roleHint}.`,
    );
  }
  return value;
}

const readonlyConnectionString = requireEnv("GYM_OWNER_RO_DATABASE_URL", "gym_owner_readonly");
const serviceConnectionString = requireEnv("GYM_MCP_SERVICE_DATABASE_URL", "gym_mcp_service");

const readonlyPassword = extractPassword(readonlyConnectionString);
const servicePassword = extractPassword(serviceConnectionString);

/**
 * Reemplaza ambas passwords (y cualquier `postgresql://...@` que se haya
 * colado) por `***` en un texto. Sanitiza contra los DOS roles siempre, sin
 * importar en qué pool ocurrió el error, para no depender de que el llamador
 * elija la función correcta.
 */
function sanitize(message: string): string {
  let out = message;
  for (const password of [readonlyPassword, servicePassword]) {
    if (password && password.length > 0) {
      out = out.split(password).join("***");
    }
  }
  out = out.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://***@");
  return out;
}

// El transaction pooler de Supabase termina TLS con un cert que no encadena a
// una CA publica. `rejectUnauthorized: false` es lo habitual para el pooler.
// TODO(seguridad): pasar a `{ ca: <supabase root cert>, rejectUnauthorized: true }`
// cuando se empaquete el cert (prod-ca-2021.crt de Supabase) para ambos pools.
const ssl = { rejectUnauthorized: false } as const;

// `max: 3` (en vez de los `max: 2` de packages/mcp-server) porque acá el
// "proceso" no es efimero por invocación como el stdio: es una función
// serverless que puede recibir invocaciones concurrentes reusando el mismo
// módulo cacheado, y hace falta margen para esa concurrencia sin agotar las
// conexiones del transaction pooler.
const poolReadonly = new Pool({
  connectionString: readonlyConnectionString,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl,
});

const poolService = new Pool({
  connectionString: serviceConnectionString,
  max: 3,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  ssl,
});

poolReadonly.on("error", (err: Error) => {
  // Un cliente idle del pool murio. No es fatal; loguear sin filtrar credenciales.
  console.error("[db] error en cliente idle del pool gym_owner_readonly:", sanitize(err.message));
});

poolService.on("error", (err: Error) => {
  console.error("[db] error en cliente idle del pool gym_mcp_service:", sanitize(err.message));
});

/**
 * Corre una query parametrizada contra el rol `gym_owner_readonly` (solo
 * SELECT sobre `public`) y devuelve solo las filas.
 * En caso de error re-lanza un Error con el mensaje sanitizado (sin password
 * ni connection string de ninguno de los dos roles).
 */
export async function queryReadonly<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await poolReadonly.query(text, params as unknown[] | undefined);
    return result.rows as T[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Error consultando la base (gym_owner_readonly): ${sanitize(raw)}`);
  }
}

/**
 * Corre una query parametrizada contra el rol `gym_mcp_service` (lectura y
 * escritura solo sobre el schema `gym_mcp`: tokens OAuth + audit log) y
 * devuelve solo las filas.
 * En caso de error re-lanza un Error con el mensaje sanitizado (sin password
 * ni connection string de ninguno de los dos roles).
 */
export async function queryService<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await poolService.query(text, params as unknown[] | undefined);
    return result.rows as T[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Error consultando la base (gym_mcp_service): ${sanitize(raw)}`);
  }
}

/** Cierra ambos pools para un shutdown limpio. */
export async function closePools(): Promise<void> {
  await Promise.all([poolReadonly.end(), poolService.end()]);
}
