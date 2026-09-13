import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryServiceMock } = vi.hoisted(() => ({ queryServiceMock: vi.fn() }));

vi.mock("./db.js", () => ({
  queryService: queryServiceMock,
}));

const { insertAuditRow, updateAuditRow } = await import("./audit.js");

describe("insertAuditRow", () => {
  beforeEach(() => {
    queryServiceMock.mockReset();
  });

  it("caso feliz: devuelve el id de la fila insertada", async () => {
    queryServiceMock.mockResolvedValueOnce([{ id: "audit-1" }]);

    const id = await insertAuditRow({
      coachProfileId: "coach-1",
      question: "¿cuántos alumnos activos hay?",
      sql: "select count(*) from public.profiles where role = 'student'",
    });

    expect(id).toBe("audit-1");
    expect(queryServiceMock).toHaveBeenCalledWith(expect.stringContaining("insert into gym_mcp.query_audit_log"), [
      "coach-1",
      "¿cuántos alumnos activos hay?",
      "select count(*) from public.profiles where role = 'student'",
    ]);
  });

  it("fail-closed: propaga el error si queryService falla, no lo swallowea (US-5)", async () => {
    queryServiceMock.mockRejectedValueOnce(new Error("Error consultando la base (gym_mcp_service): boom"));

    await expect(
      insertAuditRow({ coachProfileId: "coach-1", question: "q", sql: "select 1" }),
    ).rejects.toThrow("boom");
  });
});

describe("updateAuditRow", () => {
  beforeEach(() => {
    queryServiceMock.mockReset();
  });

  it("caso feliz: actualiza row_count/duration_ms/error", async () => {
    queryServiceMock.mockResolvedValueOnce([]);

    await updateAuditRow("audit-1", { rowCount: 3, durationMs: 42, error: null });

    expect(queryServiceMock).toHaveBeenCalledWith(expect.stringContaining("update gym_mcp.query_audit_log"), [
      "audit-1",
      3,
      42,
      null,
    ]);
  });

  it("best-effort: no tira si queryService falla, solo loguea", async () => {
    queryServiceMock.mockRejectedValueOnce(new Error("boom"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      updateAuditRow("audit-1", { rowCount: null, durationMs: 5, error: "algo falló" }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
