import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock("../db.js", () => ({
  query: queryMock,
}));

const { listStudentsHandler } = await import("./list-students.js");

describe("listStudentsHandler", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("caso feliz: devuelve la lista con el shape correcto", async () => {
    queryMock.mockResolvedValueOnce([
      {
        student_id: "s1",
        first_name: "Ana",
        last_name: "Gomez",
        is_archived: false,
        has_active_assignment: true,
        active_plan_title: "Plan Full Body",
      },
    ]);

    const result = await listStudentsHandler({ status: "active" });

    expect(result.isError).toBeUndefined();
    const body = result.structuredContent as { students: unknown[] };
    expect(body.students).toHaveLength(1);
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["active"]);
  });

  it("sin alumnos que matcheen: lista vacia, NO es un error (US-1)", async () => {
    queryMock.mockResolvedValueOnce([]);

    const result = await listStudentsHandler({ status: "archived" });

    expect(result.isError).toBeUndefined();
    const body = result.structuredContent as { students: unknown[] };
    expect(body.students).toEqual([]);
  });

  it("status='all' se pasa tal cual a la query (el filtro de is_archived lo resuelve el SQL)", async () => {
    queryMock.mockResolvedValueOnce([]);

    await listStudentsHandler({ status: "all" });

    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["all"]);
  });
});
