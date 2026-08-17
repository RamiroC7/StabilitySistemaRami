import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../features/auth/store/authStore";
import { useDataCacheStore } from "../store/dataCacheStore";
import type { Professor } from "../features/auth/store/authStore";

export interface PlanFolder {
  id: string;
  coach_id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  professor: Professor | null;
}

export function usePlanFolders() {
  const professor = useAuthStore((state: AuthState) => state.professor);
  const [folders, setFolders] = useState<PlanFolder[]>([]);
  const [loading, setLoading] = useState(true);

  // Access plan cache for optimistic folder_id update
  const setPlans = useDataCacheStore((s) => s.setPlans);
  const cachedPlans = useDataCacheStore((s) => s.plans);

  const fetchFolders = useCallback(async () => {
    if (!professor) return;
    const { data, error } = await supabase
      .from("plan_folders")
      .select("*")
      .order("name", { ascending: true });
    if (!error) setFolders((data as PlanFolder[]) ?? []);
    setLoading(false);
  }, [professor]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFolders();
  }, [fetchFolders]);

  // Real-time subscription for folders
  useEffect(() => {
    if (!professor) return;

    const channel = supabase
      .channel("plan_folders:global")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "plan_folders",
        },
        () => {
          fetchFolders();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "training_plans",
        },
        (payload) => {
          // Sync folder_id change from another device/tab into the local cache
          const updated = payload.new as { id: string; folder_id: string | null };
          setPlans(
            useDataCacheStore
              .getState()
              .plans.map((p) =>
                p.id === updated.id ? { ...p, folder_id: updated.folder_id } : p,
              ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [professor, fetchFolders, setPlans]);

  const createFolder = async (name: string, parentId?: string | null) => {
    if (!professor) return { success: false, error: "No autenticado" };
    const trimmed = name.trim();
    if (!trimmed) return { success: false, error: "El nombre no puede estar vacío" };

    const { data, error } = await supabase
      .from("plan_folders")
      .insert({ coach_id: professor.id, name: trimmed, parent_id: parentId ?? null })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    // Optimistic update — insert and keep sorted by name
    setFolders((prev) =>
      [...prev, data as PlanFolder].sort((a, b) => a.name.localeCompare(b.name)),
    );
    return { success: true };
  };

  const renameFolder = async (folderId: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return { success: false, error: "El nombre no puede estar vacío" };

    const { error } = await supabase
      .from("plan_folders")
      .update({ name: trimmed })
      .eq("id", folderId);

    if (error) return { success: false, error: error.message };
    // Optimistic update
    setFolders((prev) =>
      prev
        .map((f) => (f.id === folderId ? { ...f, name: trimmed } : f))
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    return { success: true };
  };

  const deleteFolder = async (folderId: string) => {
    // Plans with this folder_id will have folder_id set to NULL (ON DELETE SET NULL)
    const { error } = await supabase
      .from("plan_folders")
      .delete()
      .eq("id", folderId);

    if (error) return { success: false, error: error.message };
    // Optimistic update
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    return { success: true };
  };

  const movePlanToFolder = async (planId: string, folderId: string | null) => {
    const { error } = await supabase
      .from("training_plans")
      .update({ folder_id: folderId })
      .eq("id", planId);

    if (error) return { success: false, error: error.message };
    // Optimistic update — patch folder_id directly in the cached plans list
    setPlans(
      cachedPlans.map((p) => (p.id === planId ? { ...p, folder_id: folderId } : p)),
    );
    return { success: true };
  };

  return {
    folders,
    loading,
    createFolder,
    renameFolder,
    deleteFolder,
    movePlanToFolder,
  };
}
