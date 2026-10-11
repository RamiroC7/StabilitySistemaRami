import { describe, expect, it, vi } from "vitest";
import { fetchAllRows } from "./supabasePagination";

// Simula PostgREST: devuelve como mucho `pageSize` filas por request.
function fakeTable(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }));
  return vi.fn(async (from: number, to: number) => ({
    data: all.slice(from, to + 1),
    error: null,
  }));
}

describe("fetchAllRows (R19: no truncar en max_rows)", () => {
  it("junta todas las páginas cuando hay más filas que el tope", async () => {
    const query = fakeTable(2503);
    const rows = await fetchAllRows(query, 1000);
    expect(rows).toHaveLength(2503);
    expect(rows[0].id).toBe(0);
    expect(rows[2502].id).toBe(2502);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("con exactamente un múltiplo del tamaño hace una página extra vacía y corta", async () => {
    const query = fakeTable(2000);
    const rows = await fetchAllRows(query, 1000);
    expect(rows).toHaveLength(2000);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("tabla chica: una sola request", async () => {
    const query = fakeTable(5);
    expect(await fetchAllRows(query, 1000)).toHaveLength(5);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("tabla vacía", async () => {
    expect(await fetchAllRows(fakeTable(0), 1000)).toEqual([]);
  });

  it("propaga el error de la base en vez de devolver datos parciales", async () => {
    const query = vi.fn(async () => ({ data: null, error: { message: "boom" } }));
    await expect(fetchAllRows(query, 1000)).rejects.toThrow("boom");
  });
});
