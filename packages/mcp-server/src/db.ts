/**
 * Pool de `pg` a nivel de modulo (una sola vez por proceso) + helper de query.
 *
 * El proceso stdio es efimero (Claude Desktop lo levanta y lo mata), asi que el
 * pool se dimensiona chico y con timeouts cortos. Conecta como el rol
 * `mcp_readonly` por el transaction pooler de Supabase (puerto 6543).
 */
import pg from "pg";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Falta DATABASE_URL. Copiá packages/mcp-server/.env.example a .env y completá la connection string del rol mcp_readonly.",
  );
}

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

const dbPassword = extractPassword(connectionString);

/** Reemplaza la password (y el connection string entero) por `***` en un texto. */
function sanitize(message: string): string {
  let out = message;
  if (dbPassword && dbPassword.length > 0) {
    out = out.split(dbPassword).join("***");
  }
  // Por las dudas: cualquier `postgresql://...@` que se haya colado.
  out = out.replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://***@");
  return out;
}

const pool = new Pool({
  connectionString,
  max: 2,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  // El transaction pooler de Supabase termina TLS con un cert que no encadena a
  // una CA publica. `rejectUnauthorized: false` es lo habitual para el pooler.
  // TODO(seguridad): pasar a `{ ca: <supabase root cert>, rejectUnauthorized: true }`
  // cuando se empaquete el cert (prod-ca-2021.crt de Supabase).
  ssl: { rejectUnauthorized: false },
});

pool.on("error", (err: Error) => {
  // Un cliente idle del pool murio. No es fatal; loguear sin filtrar credenciales.
  console.error("[db] error en cliente idle del pool:", sanitize(err.message));
});

/**
 * Corre una query parametrizada y devuelve solo las filas.
 * En caso de error re-lanza un Error con el mensaje sanitizado (sin password
 * ni connection string).
 */
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params as unknown[] | undefined);
    return result.rows as T[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw new Error(`Error consultando la base: ${sanitize(raw)}`);
  }
}

/** Cierra el pool para un shutdown limpio (SIGINT/SIGTERM). */
export async function closePool(): Promise<void> {
  await pool.end();
}
