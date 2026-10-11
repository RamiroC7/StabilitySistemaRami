import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// R23 (rendimiento-stability): la cache vence (TTL) y invalidar no vacia la UI.

const selectMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => selectMock(),
      }),
    }),
    rpc: (...args: unknown[]) => rpcMock(...args),
  },
}));

import { STALE_MS, useDataCacheStore } from "./dataCacheStore";

describe("dataCacheStore: TTL y stale-while-revalidate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
    selectMock.mockReset();
    rpcMock.mockReset();
    selectMock.mockResolvedValue({
      data: [{ id: "c1", name: "Pecho", color: "#fff" }],
      error: null,
    });
    useDataCacheStore.getState().clearAll();
    useDataCacheStore.setState({
      categories: [],
      isCategoriesLoaded: false,
      isCategoriesLoading: false,
      categoriesFetchedAt: 0,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("no refetchea mientras el dato esta fresco", async () => {
    await useDataCacheStore.getState().fetchCategories();
    await useDataCacheStore.getState().fetchCategories();
    expect(selectMock).toHaveBeenCalledTimes(1);
  });

  it("refetchea cuando vence el TTL y conserva el dato mientras tanto", async () => {
    await useDataCacheStore.getState().fetchCategories();
    expect(selectMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(STALE_MS.categories + 1000);
    const pending = useDataCacheStore.getState().fetchCategories();
    // Durante el refetch el dato viejo sigue disponible (no se vacia la UI).
    expect(useDataCacheStore.getState().categories).toHaveLength(1);
    await pending;
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("invalidar (reload) no vacia la lista", () => {
    useDataCacheStore.setState({
      students: [
        {
          id: "s1",
          fullName: "Ana Perez",
          profileImageUrl: null,
          trainingLevel: "beginner",
          primaryGoal: "health",
          activityLevel: "moderate",
          isArchived: false,
        },
      ],
      isStudentsLoaded: true,
    });
    useDataCacheStore.getState().reloadStudents();
    const state = useDataCacheStore.getState();
    expect(state.isStudentsLoaded).toBe(false);
    expect(state.students).toHaveLength(1);
  });

  it("dedupe: dos fetch simultaneos hacen una sola request", async () => {
    await Promise.all([
      useDataCacheStore.getState().fetchCategories(),
      useDataCacheStore.getState().fetchCategories(),
    ]);
    expect(selectMock).toHaveBeenCalledTimes(1);
  });
});
