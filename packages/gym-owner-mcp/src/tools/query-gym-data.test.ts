import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryReadonlyMock, insertAuditRowMock, updateAuditRowMock } = vi.hoisted(() => ({
  queryReadonlyMock: vi.fn(),
  insertAuditRowMock: vi.fn(),
  updateAuditRowMock: vi.fn(),
}));

vi.mock("../db.js", () => ({
  queryReadonly: queryReadonlyMock,
}));

vi.mock("../audit.js", () => ({
  insertAuditRow: insertAuditRowMock,
  updateAuditRow: updateAuditRowMock,
}));

const { createQueryGymDataHandler } = await import("./query-gym-data.js");

const identity = { profileId: "coach-1", label: "Coach de prueba" };

describe("createQueryGymDataHandler", () => {
  beforeEach(() => {
    queryReadonlyMock.mockReset();
    insertAuditRowMock.mockReset();
    updateAuditRowMock.mockReset();
    updateAuditRowMock.mockResolvedValue(undefined);
  });

  it("caso feliz: audita antes, corre el SQL, y devuelve row_count correcto", async () => {
    insertAuditRowMock.mockResolvedValueOnce("audit-1");
    queryReadonlyMock.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);

    const handler = createQueryGymDataHandler(identity);
    const result = await handler({ question: "¿cuántos alumnos activos hay?", sql: "select 1" });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({
      rows: [{ id: 1 }, { id: 2 }],
      row_count: 2,
      truncated: false,
    });
    expect(insertAuditRowMock).toHaveBeenCalledWith({
      coachProfileId: "coach-1",
      question: "¿cuántos alumnos activos hay?",
      sql: "select 1",
    });
    expect(updateAuditRowMock).toHaveBeenCalledWith(
      "audit-1",
      expect.objectContaining({ rowCount: 2, error: null }),
    );
    const text = (result.content?.[0] as { text: string }).text;
    expect(text).toBe("Devolví 2 fila(s).");
    expect(text).not.toContain("{");
    expect(text).not.toContain('"id"');
  });

  it("más de MAX_ROWS filas: trunca a 200, marca truncated, y avisa el total real sin repetir filas", async () => {
    insertAuditRowMock.mockResolvedValueOnce("audit-3");
    const fakeRows = Array.from({ length: 250 }, (_, i) => ({
      id: i,
      marcador_unico_no_deberia_aparecer_en_content: `fila-${i}`,
    }));
    queryReadonlyMock.mockResolvedValueOnce(fakeRows);

    const handler = createQueryGymDataHandler(identity);
    const result = await handler({ question: "todos los registros", sql: "select * from t" });

    expect(result.isError).toBeUndefined();
    const structuredContent = result.structuredContent as {
      rows: unknown[];
      row_count: number;
      truncated: boolean;
    };
    expect(structuredContent.rows.length).toBe(200);
    expect(structuredContent.row_count).toBe(200);
    expect(structuredContent.truncated).toBe(true);

    const text = (result.content?.[0] as { text: string }).text;
    expect(text).toContain("250");
    expect(text).not.toContain("marcador_unico_no_deberia_aparecer_en_content");

    // La auditoría graba el total real encontrado, no el truncado.
    expect(updateAuditRowMock).toHaveBeenCalledWith(
      "audit-3",
      expect.objectContaining({ rowCount: 250, error: null }),
    );
  });

  it("fail-closed (US-5): si insertAuditRow falla, propaga y NUNCA corre queryReadonly", async () => {
    insertAuditRowMock.mockRejectedValueOnce(new Error("no se pudo escribir el audit log"));

    const handler = createQueryGymDataHandler(identity);

    await expect(handler({ question: "q", sql: "select 1" })).rejects.toThrow(
      "no se pudo escribir el audit log",
    );
    expect(queryReadonlyMock).not.toHaveBeenCalled();
    expect(updateAuditRowMock).not.toHaveBeenCalled();
  });

  it("SQL inválido: devuelve isError sin credenciales y actualiza la auditoría con el error", async () => {
    insertAuditRowMock.mockResolvedValueOnce("audit-2");
    queryReadonlyMock.mockRejectedValueOnce(
      new Error("Error consultando la base (gym_owner_readonly): syntax error at or near \"selct\""),
    );

    const handler = createQueryGymDataHandler(identity);
    const result = await handler({ question: "q", sql: "selct 1" });

    expect(result.isError).toBe(true);
    const text = (result.content?.[0] as { text: string }).text;
    expect(text).not.toMatch(/postgres(?:ql)?:\/\//i);
    expect(text).not.toMatch(/password/i);
    expect(updateAuditRowMock).toHaveBeenCalledWith(
      "audit-2",
      expect.objectContaining({ rowCount: null, error: expect.stringContaining("syntax error") }),
    );
  });
});
