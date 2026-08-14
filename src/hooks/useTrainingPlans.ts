import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../features/auth/store/authStore";
import { useDataCacheStore } from "../store/dataCacheStore";
import type { PlanExercise } from "../lib/types";
import type { Professor } from "../features/auth/store/authStore";

interface Day {
  id: string;
  number: number;
  name: string;
}

interface TrainingPlanDay {
  id: string;
  day_number: number;
  day_name: string;
  display_order: number;
  training_plan_exercises?: TrainingPlanExercise[];
}

interface TrainingPlanExercise {
  id: string;
  stage_id: string;
  stage_name: string;
  exercise_name: string;
  video_url: string | null;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  display_order: number;
  write_weight?: boolean;
  coach_instructions?: string | null;
  cardio_duration_min?: number | null;
  circuit_group?: string | null;
}

interface SavePlanData {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  days: Day[];
  exercises: PlanExercise[];
  isTemplate: boolean;
  durationWeeks?: number;
  daysPerWeek?: number;
}

export interface TrainingPlanSummary {
  id: string;
  coach_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  total_days: number;
  days_per_week: number;
  total_weeks: number;
  plan_type: string | null;
  difficulty_level: string | null;
  is_template: boolean;
  is_archived: boolean;
  created_at: string;
  folder_id: string | null;
  assignedCount: number;
}

interface AuthState {
  professor: Professor | null;
}

const formatLocalDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export function useTrainingPlans() {
  const professor = useAuthStore((state: AuthState) => state.professor);

  // Read from shared cache store
  const plans = useDataCacheStore((s) => s.plans);
  const isLoaded = useDataCacheStore((s) => s.isPlansLoaded);
  const isLoading = useDataCacheStore((s) => s.isPlansLoading);
  const fetchPlans = useDataCacheStore((s) => s.fetchPlans);
  const reloadPlans = useDataCacheStore((s) => s.reloadPlans);

  useEffect(() => {
    if (!professor) return;
    fetchPlans(professor.id);
  }, [professor, fetchPlans, isLoaded]);

  /** Invalida la caché y re-fetcha. Llamar tras cualquier mutación. */
  const invalidateAndReload = (professorId: string) => {
    reloadPlans(); // marca isPlansLoaded: false sincrónicamente
    // Diferir el fetch al siguiente tick para que Zustand procese el set() anterior
    // antes de que fetchPlans() lea los flags guard (isPlansLoaded, isPlansLoading).
    setTimeout(() => fetchPlans(professorId), 0);
  };

  // Keep a stable reference for the mutator functions below
  const professorId = professor?.id ?? "";
  const loading = isLoading && !isLoaded;

  const savePlan = async (planData: SavePlanData) => {
    if (!professor) {
      return { success: false, error: "No hay usuario autenticado" };
    }

    try {
      // Calculate plan metadata
      const totalDays = planData.days.length;
      const msPerDay = 24 * 60 * 60 * 1000;
      const totalDaysInPeriod =
        Math.ceil(
          (planData.endDate.getTime() - planData.startDate.getTime()) /
          msPerDay,
        ) + 1;
      const calculatedWeeks = Math.ceil(totalDaysInPeriod / 7);
      const totalWeeks = planData.durationWeeks ?? calculatedWeeks;
      const daysPerWeek = planData.daysPerWeek ?? totalDays;
      console.log(
        "[savePlan] duration_weeks:",
        totalWeeks,
        "days_per_week:",
        daysPerWeek,
        "(user provided:",
        !!planData.durationWeeks,
        ")",
      );

      // 1. Insert the main training plan
      const { data: insertedPlan, error: planError } = await supabase
        .from("training_plans")
        .insert([
          {
            coach_id: professor.id,
            title: planData.title,
            description: planData.description || null,
            start_date: formatLocalDate(planData.startDate),
            end_date: formatLocalDate(planData.endDate),
            total_days: totalDays,
            days_per_week: daysPerWeek,
            total_weeks: totalWeeks,
            plan_type: planData.isTemplate ? "template" : "custom",
            difficulty_level: null,
            is_template: planData.isTemplate,
            is_archived: false,
          },
        ])
        .select()
        .single();

      if (planError) throw planError;
      if (!insertedPlan) throw new Error("No se pudo crear el plan");

      // 2. Insert training plan days
      const daysToInsert = planData.days.map((day, index) => ({
        plan_id: insertedPlan.id,
        day_number: day.number,
        day_name: day.name,
        display_order: index,
      }));

      const { data: insertedDays, error: daysError } = await supabase
        .from("training_plan_days")
        .insert(daysToInsert)
        .select();

      if (daysError) throw daysError;
      if (!insertedDays) throw new Error("No se pudieron crear los días");

      // 3. Create a mapping from old day IDs to new day IDs
      const dayIdMap = new Map<string, string>();
      planData.days.forEach((originalDay, index) => {
        dayIdMap.set(originalDay.id, insertedDays[index].id);
      });

      // 4. Insert training plan exercises
      const exercisesToInsert = planData.exercises
        .filter((ex) => ex.day_id) // Ensure exercise has a day
        .map((ex, index) => {
          const newDayId = dayIdMap.get(ex.day_id);
          if (!newDayId) {
            console.warn(`Could not find new day ID for exercise ${ex.id}`);
            return null;
          }

          return {
            day_id: newDayId,
            stage_id: ex.stage_id || null,
            stage_name: ex.stage_name || '-',
            exercise_name: ex.exercise_name,
            video_url: ex.video_url || null,
            series: typeof ex.series === 'number' ? ex.series : (parseInt(ex.series as string) || 0),
            reps: ex.reps || '-',
            carga: ex.carga || '-',
            pause: ex.pause || '-',
            notes: ex.notes || null,
            coach_instructions: null,
            display_order: index,
            write_weight: ex.write_weight ?? false,
            cardio_duration_min: ex.cardio_duration_min !== undefined && ex.cardio_duration_min !== '' ? Number(ex.cardio_duration_min) : null,
            circuit_group: ex.circuit_group || null,
          };
        })
        .filter((ex) => ex !== null);

      if (exercisesToInsert.length > 0) {
        const { error: exercisesError } = await supabase
          .from("training_plan_exercises")
          .insert(exercisesToInsert);

        if (exercisesError) throw exercisesError;
      }

      // Invalidate cache so the list refreshes
      invalidateAndReload(professorId);

      return { success: true, planId: insertedPlan.id };
    } catch (err) {
      console.error("Error saving training plan:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const updatePlan = async (planId: string, planData: SavePlanData) => {
    if (!professor) {
      return { success: false, error: "No hay usuario autenticado" };
    }

    try {
      // Calculate plan metadata
      const totalDays = planData.days.length;
      const msPerDay = 24 * 60 * 60 * 1000;
      const totalDaysInPeriod =
        Math.ceil(
          (planData.endDate.getTime() - planData.startDate.getTime()) /
          msPerDay,
        ) + 1;
      const calculatedWeeks = Math.ceil(totalDaysInPeriod / 7);
      const totalWeeks = planData.durationWeeks ?? calculatedWeeks;
      const daysPerWeek = planData.daysPerWeek ?? totalDays;
      console.log(
        "[updatePlan] duration_weeks:",
        totalWeeks,
        "days_per_week:",
        daysPerWeek,
        "(user provided:",
        !!planData.durationWeeks,
        ")",
      );

      // 1. Update the main training plan record
      const { error: planError } = await supabase
        .from("training_plans")
        .update({
          title: planData.title,
          description: planData.description || null,
          start_date: formatLocalDate(planData.startDate),
          end_date: formatLocalDate(planData.endDate),
          total_days: totalDays,
          days_per_week: daysPerWeek,
          total_weeks: totalWeeks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId);

      if (planError) throw planError;

      // Sincronizar fechas en las asignaciones de este plan.
      // También reseteamos completed_days y current_day_number en los assignments
      // activos: si el coach reprogramó el plan hacia adelante, el progreso
      // realizado en el período anterior no debe contar.
      const newStartDate = formatLocalDate(planData.startDate);
      const newEndDate = formatLocalDate(planData.endDate);

      const { error: cascadeError } = await supabase
        .from("training_plan_assignments")
        .update({
          start_date: newStartDate,
          end_date: newEndDate,
          completed_days: 0,
          current_day_number: 1,
        })
        .eq("plan_id", planId)
        .eq("status", "active");

      if (cascadeError) {
        console.warn("Could not sync training plan assignments:", cascadeError);
      }

      // 2. Fetch existing days from DB
      const { data: existingDays, error: fetchDaysError } = await supabase
        .from("training_plan_days")
        .select("id")
        .eq("plan_id", planId);

      if (fetchDaysError) throw fetchDaysError;

      const existingDayIds = new Set(
        (existingDays || []).map((d: { id: string }) => d.id),
      );
      const newDayIds = new Set(planData.days.map((d) => d.id));

      // Categorize days: update existing, insert new, delete removed
      const daysToUpdate = planData.days.filter((d) =>
        existingDayIds.has(d.id),
      );
      const daysToInsert = planData.days.filter(
        (d) => !existingDayIds.has(d.id),
      );
      const dayIdsToDelete = [...existingDayIds].filter(
        (id) => !newDayIds.has(id),
      );

      // 3. Delete removed days (CASCADE handles exercises automatically)
      if (dayIdsToDelete.length > 0) {
        const { error: deleteDaysError } = await supabase
          .from("training_plan_days")
          .delete()
          .in("id", dayIdsToDelete);
        if (deleteDaysError) throw deleteDaysError;
      }

      // 4. Update existing days metadata (Batch upsert)
      const daysToUpsert = daysToUpdate.map((day) => ({
        id: day.id,
        plan_id: planId,
        day_number: day.number,
        day_name: day.name,
        display_order: planData.days.indexOf(day),
      }));

      if (daysToUpsert.length > 0) {
        const { error: updateDaysError } = await supabase
          .from("training_plan_days")
          .upsert(daysToUpsert);
        if (updateDaysError) throw updateDaysError;
      }

      // 5. Insert new days and build ID map (tempId → newDbId)
      const dayIdMap = new Map<string, string>();
      daysToUpdate.forEach((d) => dayIdMap.set(d.id, d.id)); // existing days map to themselves

      if (daysToInsert.length > 0) {
        const daysToInsertData = daysToInsert.map((day) => ({
          plan_id: planId,
          day_number: day.number,
          day_name: day.name,
          display_order: planData.days.indexOf(day),
        }));

        const { data: insertedDays, error: insertDaysError } = await supabase
          .from("training_plan_days")
          .insert(daysToInsertData)
          .select();

        if (insertDaysError) throw insertDaysError;
        daysToInsert.forEach((day, index) => {
          dayIdMap.set(day.id, insertedDays![index].id);
        });
      }

      // 6. Fetch existing exercises for all existing days of this plan
      const existingDayIdsArray = Array.from(existingDayIds);
      const existingExercises: { id: string; day_id: string }[] = [];

      if (existingDayIdsArray.length > 0) {
        const { data: exData, error: fetchExError } = await supabase
          .from("training_plan_exercises")
          .select("id, day_id")
          .in("day_id", existingDayIdsArray);

        if (fetchExError) throw fetchExError;
        if (exData) {
          existingExercises.push(...exData);
        }
      }

      const existingExIds = new Set(existingExercises.map((e) => e.id));

      // Categorize exercises: update existing, insert new, delete removed
      const exToUpdate: PlanExercise[] = [];
      const exToInsert: PlanExercise[] = [];
      const newExIds = new Set<string>();

      for (const ex of planData.exercises) {
        newExIds.add(ex.id);
        if (existingExIds.has(ex.id)) {
          exToUpdate.push(ex);
        } else {
          exToInsert.push(ex);
        }
      }

      const exIdsToDelete = existingExercises
        .map((e) => e.id)
        .filter((id) => !newExIds.has(id));

      // Delete removed exercises
      if (exIdsToDelete.length > 0) {
        const { error: deleteExError } = await supabase
          .from("training_plan_exercises")
          .delete()
          .in("id", exIdsToDelete);
        if (deleteExError) throw deleteExError;
      }

      // Update/Upsert existing/modified exercises in batch
      const exercisesToUpsert = exToUpdate.map((ex) => {
        const dbDayId = dayIdMap.get(ex.day_id)!;
        const dayExercises = planData.exercises.filter((e) => e.day_id === ex.day_id);
        const displayOrder = dayExercises.indexOf(ex);
        return {
          id: ex.id,
          day_id: dbDayId,
          stage_id: ex.stage_id || null,
          stage_name: ex.stage_name || '-',
          exercise_name: ex.exercise_name,
          video_url: ex.video_url || null,
          series: typeof ex.series === 'number' ? ex.series : (parseInt(ex.series as string) || 0),
          reps: ex.reps || '-',
          carga: ex.carga || '-',
          pause: ex.pause || '-',
          notes: ex.notes || null,
          display_order: displayOrder,
          write_weight: ex.write_weight ?? false,
          cardio_duration_min: ex.cardio_duration_min !== undefined && ex.cardio_duration_min !== '' ? Number(ex.cardio_duration_min) : null,
          circuit_group: ex.circuit_group || null,
        };
      });

      if (exercisesToUpsert.length > 0) {
        const { error: updateExError } = await supabase
          .from("training_plan_exercises")
          .upsert(exercisesToUpsert);
        if (updateExError) throw updateExError;
      }

      // Group new exercises to insert
      const newExercisesData = [];

      // Exercises to insert on existing/updated days
      for (const ex of exToInsert) {
        const dbDayId = dayIdMap.get(ex.day_id);
        if (!dbDayId) continue;
        const dayExercises = planData.exercises.filter((e) => e.day_id === ex.day_id);
        const displayOrder = dayExercises.indexOf(ex);
        newExercisesData.push({
          day_id: dbDayId,
          stage_id: ex.stage_id || null,
          stage_name: ex.stage_name || '-',
          exercise_name: ex.exercise_name,
          video_url: ex.video_url || null,
          series: typeof ex.series === 'number' ? ex.series : (parseInt(ex.series as string) || 0),
          reps: ex.reps || '-',
          carga: ex.carga || '-',
          pause: ex.pause || '-',
          notes: ex.notes || null,
          coach_instructions: null,
          display_order: displayOrder,
          write_weight: ex.write_weight ?? false,
          cardio_duration_min: ex.cardio_duration_min !== undefined && ex.cardio_duration_min !== '' ? Number(ex.cardio_duration_min) : null,
          circuit_group: ex.circuit_group || null,
        });
      }



      if (newExercisesData.length > 0) {
        const { error: insertExError } = await supabase
          .from("training_plan_exercises")
          .insert(newExercisesData);
        if (insertExError) throw insertExError;
      }

      invalidateAndReload(professorId);
      return { success: true, planId };
    } catch (err) {
      console.error("Error updating training plan:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const deletePlan = async (planId: string) => {
    try {
      // Soft delete - just mark as archived.
      // No filtramos por coach_id: cualquier coach puede eliminar cualquier plan.
      // La RLS policy garantiza que solo coaches autenticados pueden hacer UPDATE.
      const { error: updateError } = await supabase
        .from("training_plans")
        .update({ is_archived: true })
        .eq("id", planId);

      if (updateError) throw updateError;

      invalidateAndReload(professorId);

      return { success: true };
    } catch (err) {
      console.error("Error deleting training plan:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const duplicatePlan = async (planId: string) => {
    if (!professor) {
      return { success: false, error: "No hay usuario autenticado" };
    }

    try {
      // 1. Fetch the complete plan with all days and exercises
      // No filtramos por coach_id: cualquier coach puede duplicar un plan visible.
      const { data: originalPlan, error: fetchError } = await supabase
        .from("training_plans")
        .select(
          `
          *,
          training_plan_days (
            *,
            training_plan_exercises (*)
          )
        `,
        )
        .eq("id", planId)
        .single();

      if (fetchError) throw fetchError;
      if (!originalPlan) throw new Error("Plan no encontrado");

      // 2. Create new plan with "Copia de " prefix
      const { data: newPlan, error: planError } = await supabase
        .from("training_plans")
        .insert([
          {
            coach_id: professor.id,
            title: `Copia de ${originalPlan.title}`,
            description: originalPlan.description,
            start_date: originalPlan.start_date,
            end_date: originalPlan.end_date,
            total_days: originalPlan.total_days,
            days_per_week: originalPlan.days_per_week,
            total_weeks: originalPlan.total_weeks,
            plan_type: originalPlan.plan_type,
            difficulty_level: originalPlan.difficulty_level,
            is_template: originalPlan.is_template,
            is_archived: false,
          },
        ])
        .select()
        .single();

      if (planError) throw planError;
      if (!newPlan) throw new Error("No se pudo crear el plan duplicado");

      // 3. Duplicate days
      const days = originalPlan.training_plan_days || [];
      const daysToInsert = days.map((day: TrainingPlanDay, index: number) => ({
        plan_id: newPlan.id,
        day_number: day.day_number,
        day_name: day.day_name,
        display_order: index,
      }));

      const { data: newDays, error: daysError } = await supabase
        .from("training_plan_days")
        .insert(daysToInsert)
        .select();

      if (daysError) throw daysError;
      if (!newDays) throw new Error("No se pudieron duplicar los días");

      // 4. Create mapping from old day IDs to new day IDs
      const dayIdMap = new Map<string, string>();
      days.forEach((originalDay: TrainingPlanDay, index: number) => {
        dayIdMap.set(originalDay.id, newDays[index].id);
      });

      // 5. Duplicate exercises
      const allExercises: (TrainingPlanExercise & { originalDayId: string })[] = [];
      days.forEach((day: TrainingPlanDay) => {
        const exercises = day.training_plan_exercises || [];
        exercises.forEach((ex: TrainingPlanExercise) => {
          allExercises.push({ ...ex, originalDayId: day.id });
        });
      });

      if (allExercises.length > 0) {
        const exercisesToInsert = allExercises.map((ex) => {
          const newDayId = dayIdMap.get(ex.originalDayId);
          return {
            day_id: newDayId,
            stage_id: ex.stage_id,
            stage_name: ex.stage_name || '-',
            exercise_name: ex.exercise_name,
            video_url: ex.video_url,
            series: ex.series,
            reps: ex.reps || '-',
            carga: ex.carga || '-',
            pause: ex.pause || '-',
            notes: ex.notes,
            coach_instructions: ex.coach_instructions,
            display_order: ex.display_order,
            write_weight: ex.write_weight ?? false,
            cardio_duration_min: ex.cardio_duration_min ?? null,
            circuit_group: ex.circuit_group ?? null,
          };
        });

        const { error: exercisesError } = await supabase
          .from("training_plan_exercises")
          .insert(exercisesToInsert);

        if (exercisesError) throw exercisesError;
      }

      invalidateAndReload(professorId);

      return { success: true, planId: newPlan.id };
    } catch (err) {
      console.error("Error duplicating training plan:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const assignPlanToStudents = async (
    planId: string,
    studentIds: string[],
    startDate: Date,
    endDate: Date,
  ) => {
    if (!professor) {
      return { success: false, error: "No hay usuario autenticado" };
    }

    try {
      // --- NUEVA VALIDACIÓN: Chequear si ya existen asignaciones ---
      const { data: existingAssignments, error: checkError } = await supabase
        .from("training_plan_assignments")
        .select("student_id")
        .eq("plan_id", planId)
        .in("student_id", studentIds)
        .neq("status", "cancelled");

      if (checkError) throw checkError;

      // Si encuentra al menos un registro, frenamos todo
      if (existingAssignments && existingAssignments.length > 0) {
        return {
          success: false,
          error: "Uno o más alumnos seleccionados ya tienen este plan asignado."
        };
      }
      // -------------------------------------------------------------

      // Create assignments for each student
      const assignments = studentIds.map((studentId) => ({
        plan_id: planId,
        student_id: studentId,
        coach_id: professor.id,
        start_date: formatLocalDate(startDate),
        end_date: formatLocalDate(endDate),
        status: "active",
        current_day_number: 1,
        completed_days: 0,
      }));

      const { error: assignError } = await supabase
        .from("training_plan_assignments")
        .insert(assignments);

      if (assignError) throw assignError;

      invalidateAndReload(professorId);
      return { success: true };
    } catch (err) {
      console.error("Error assigning plan to students:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const getAssignedStudents = async (planIdToFetch: string) => {
    console.log("[getAssignedStudents] fetching for planId:", planIdToFetch);
    try {
      // Step 1: fetch assignments only (no JOIN, avoids FK name issues)
      const { data: assignments, error: assignError } = await supabase
        .from("training_plan_assignments")
        .select(
          "id, student_id, start_date, end_date, status, current_day_number, completed_days, created_at",
        )
        .eq("plan_id", planIdToFetch)
        .neq("status", "cancelled");

      console.log(
        "[getAssignedStudents] assignments:",
        assignments,
        "error:",
        assignError,
      );

      if (assignError) {
        console.error(
          "[getAssignedStudents] DB error:",
          assignError.message,
          assignError.details,
          assignError.hint,
        );
        throw new Error(`Error al leer asignaciones: ${assignError.message}`);
      }

      if (!assignments || assignments.length === 0) {
        console.log("[getAssignedStudents] no assignments found");
        return { success: true, students: [] };
      }

      // Step 2: fetch plan total_days
      const { data: planRow } = await supabase
        .from("training_plans")
        .select("total_days")
        .eq("id", planIdToFetch)
        .single();
      const totalDays = planRow?.total_days || 0;

      // Step 3: fetch profiles separately (avoids FK constraints)
      const studentIds = assignments.map((a) => a.student_id);
      console.log("[getAssignedStudents] fetching profiles for:", studentIds);

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, profile_image")
        .in("id", studentIds);

      console.log(
        "[getAssignedStudents] profiles:",
        profiles,
        "error:",
        profilesError,
      );

      if (profilesError) {
        // Non-fatal: show students without profile data
        console.warn(
          "[getAssignedStudents] profiles error (non-fatal):",
          profilesError.message,
        );
      }

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return {
        success: true,
        students: assignments.map((row) => {
          const profile = profileMap.get(row.student_id);
          return {
            assignmentId: row.id,
            studentId: row.student_id,
            fullName: profile ? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sin nombre" : "Sin nombre",
            email: profile?.email || "Sin email",
            avatarUrl: profile?.profile_image || null,
            startDate: row.start_date,
            endDate: row.end_date,
            status: row.status || "active",
            currentDay: row.current_day_number || 1,
            completedDays: row.completed_days || 0,
            totalDays,
            assignedAt: row.created_at,
          };
        }),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[getAssignedStudents] caught error:", msg);
      return {
        success: false,
        students: [],
        error: msg,
      };
    }
  };

  const unassignStudent = async (assignmentId: string) => {
    try {
      // Soft-delete: mark as "cancelled" instead of physically deleting.
      // A hard DELETE would cascade and permanently erase all workout_completions
      // linked to this assignment, causing historical attendance to disappear
      // from the student's calendar and ranking.
      const { error: updateError } = await supabase
        .from("training_plan_assignments")
        .update({ status: "cancelled" })
        .eq("id", assignmentId);

      if (updateError) throw updateError;

      invalidateAndReload(professorId); // Refresh counts
      return { success: true };
    } catch (err) {
      console.error("Error unassigning student:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  const renamePlan = async (planId: string, newTitle: string) => {
    try {
      const { error } = await supabase
        .from("training_plans")
        .update({ title: newTitle })
        .eq("id", planId);

      if (error) throw error;

      invalidateAndReload(professorId);
      return { success: true };
    } catch (err) {
      console.error("Error renaming training plan:", err);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Error desconocido",
      };
    }
  };

  return {
    plans,
    loading,
    error: null,
    savePlan,
    updatePlan,
    deletePlan,
    duplicatePlan,
    renamePlan,
    assignPlanToStudents,
    getAssignedStudents,
    unassignStudent,
    reload: () => invalidateAndReload(professorId),
  };
}

interface TrainingPlanExercise {
  id: string;
  stage_id: string;
  stage_name: string;
  exercise_name: string;
  video_url: string | null;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  display_order: number;
  write_weight?: boolean;
  coach_instructions?: string | null;
  cardio_duration_min?: number | null;
  circuit_group?: string | null;
}

interface TrainingPlanDetailDay extends TrainingPlanDay {
  training_plan_exercises?: TrainingPlanExercise[];
}

interface TrainingPlanDetail {
  id: string;
  title: string;
  description: string | null;
  created_by: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_weeks: number;
  days_per_week: number;
  plan_type: string | null;
  difficulty_level: string | null;
  folder_id: string | null;
  training_plan_days?: TrainingPlanDetailDay[];
  training_plan_assignments?: { count: number }[];
}

// Hook to fetch a single plan with all its days and exercises
export function useTrainingPlanDetail(planId: string | null) {
  const [plan, setPlan] = useState<TrainingPlanDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setPlan(null);
      return;
    }

    const fetchPlanDetail = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch plan with days and exercises
        const { data: planData, error: planError } = await supabase
          .from("training_plans")
          .select(
            `
            *,
            training_plan_days (
              *,
              training_plan_exercises (*)
            ),
            training_plan_assignments (count)
          `,
          )
          .eq("id", planId)
          .neq("training_plan_assignments.status", "cancelled")
          .single();

        if (planError) throw planError;

        setPlan(planData);
      } catch (err) {
        console.error("Error loading plan detail:", err);
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchPlanDetail();
  }, [planId]);

  return { plan, loading, error };
}
