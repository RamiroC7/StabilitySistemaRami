// Regla R19 (rendimiento-stability): PostgREST/Supabase corta cada request en
// `max_rows` (1.000 por defecto) SIN dar error. Cualquier lectura "de toda la
// tabla" tiene que paginar, o los resultados quedan truncados en silencio.

export const PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Lee todas las filas de una consulta paginando de a PAGE_SIZE con `.range()`.
 *
 * `buildQuery(from, to)` debe devolver la consulta ya con `.range(from, to)` y
 * con un `.order(...)` DETERMINISTA (por ejemplo por `id`): sin orden estable
 * las paginas pueden solaparse o saltear filas.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize: number = PAGE_SIZE,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
