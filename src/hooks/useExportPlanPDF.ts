import { useRef, useState, useCallback } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "../lib/supabase";
import type {
  PlanPDFData,
  PdfDay,
} from "../features/library/components/PlanPDFTemplate";

// ──────────────────────────────────────────────────────────────────────────────
// Local DB-row types (minimal — only what we need)
// ──────────────────────────────────────────────────────────────────────────────

interface PlanRow {
  id: string;
  title: string;
  created_at: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  days_per_week: number;
  training_plan_days: DayRow[];
}

interface DayRow {
  id: string;
  day_number: number;
  day_name: string;
  display_order: number;
  training_plan_exercises: ExerciseRow[];
}

interface ExerciseRow {
  id: string;
  stage_name: string;
  exercise_name: string;
  series: number;
  reps: string;
  carga: string;
  pause: string;
  notes: string | null;
  display_order: number;
}

interface AssignmentRow {
  student_id: string;
}

interface ProfileRow {
  id: string;
  first_name: string;
  last_name: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// PDF generation helper
// ──────────────────────────────────────────────────────────────────────────────

async function generatePdfFromElement(
  element: HTMLElement,
  fileName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    allowTaint: false,
    backgroundColor: "#ffffff",
    logging: false,
    // Ensure off-screen elements are captured correctly
    scrollX: 0,
    scrollY: 0,
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  const imgProps = pdf.getImageProperties(imgData);
  const imgWidth = pageWidth;
  const imgHeight = (imgProps.height * imgWidth) / imgProps.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(fileName);
}

// ──────────────────────────────────────────────────────────────────────────────
// Data fetchers
// ──────────────────────────────────────────────────────────────────────────────

async function fetchFullPlan(planId: string): Promise<PlanRow | null> {
  const { data, error } = await supabase
    .from("training_plans")
    .select(
      `
      id,
      title,
      created_at,
      start_date,
      end_date,
      total_weeks,
      days_per_week,
      training_plan_days (
        id,
        day_number,
        day_name,
        display_order,
        training_plan_exercises (
          id,
          stage_name,
          exercise_name,
          series,
          reps,
          carga,
          pause,
          notes,
          display_order
        )
      )
      `,
    )
    .eq("id", planId)
    .single();

  if (error) {
    console.error("useExportPlanPDF: error fetching plan", error);
    return null;
  }

  return data as PlanRow;
}

async function fetchAssignedStudents(planId: string): Promise<string[]> {
  try {
    // Get ALL active/valid student assignments for this plan
    const { data: assignments, error: assignErr } = await supabase
      .from("training_plan_assignments")
      .select("student_id")
      .eq("plan_id", planId)
      .neq("status", "cancelled");

    if (assignErr || !assignments || assignments.length === 0) return [];

    const studentIds = (assignments as AssignmentRow[]).map(
      (a) => a.student_id,
    );

    // Fetch all profiles in one query
    const { data: profiles, error: profilesErr } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", studentIds);

    if (profilesErr || !profiles) return [];

    return (profiles as ProfileRow[]).map((p) =>
      `${p.first_name} ${p.last_name}`.trim(),
    );
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────────────────────────────────────

export interface UseExportPlanPDFReturn {
  /** Ref to attach to the hidden PDF template wrapper element. */
  templateRef: React.RefObject<HTMLDivElement>;
  /** The data to pass into <PlanPDFTemplate data={pdfData} />. Only set while exporting. */
  pdfData: PlanPDFData | null;
  /** True while generating the PDF canvas / downloading. */
  isExporting: boolean;
  /** Call this to trigger the full export flow. */
  exportPDF: (planId: string) => Promise<void>;
}

export function useExportPlanPDF(): UseExportPlanPDFReturn {
  const templateRef = useRef<HTMLDivElement>(null!);
  const [pdfData, setPdfData] = useState<PlanPDFData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportPDF = useCallback(
    async (planId: string) => {
      if (isExporting) return;
      setIsExporting(true);

      try {
        // 1 — Fetch plan data and all assigned students in parallel
        const [planRow, studentNames] = await Promise.all([
          fetchFullPlan(planId),
          fetchAssignedStudents(planId),
        ]);

        if (!planRow) {
          console.error("useExportPlanPDF: could not load plan");
          return;
        }

        // 2 — Convert DB rows to PDF data shape
        const days: PdfDay[] = (planRow.training_plan_days ?? []).map((d) => ({
          id: d.id,
          day_number: d.day_number,
          day_name: d.day_name,
          display_order: d.display_order,
          training_plan_exercises: (d.training_plan_exercises ?? []).map(
            (ex) => ({
              id: ex.id,
              stage_name: ex.stage_name,
              exercise_name: ex.exercise_name,
              series: ex.series,
              reps: ex.reps,
              carga: ex.carga,
              pause: ex.pause,
              notes: ex.notes,
              display_order: ex.display_order,
            }),
          ),
        }));

        const data: PlanPDFData = {
          title: planRow.title,
          created_at: planRow.created_at,
          start_date: planRow.start_date,
          end_date: planRow.end_date,
          total_weeks: planRow.total_weeks,
          days_per_week: planRow.days_per_week,
          days,
          studentNames,
        };

        // 3 — Inject data → triggers React render of the hidden template
        setPdfData(data);

        // 4 — Give React one animation frame to commit the render
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
        // Extra tick for browsers that need it
        await new Promise<void>((resolve) => setTimeout(resolve, 150));

        // 5 — Generate and download the PDF
        if (templateRef.current) {
          const safeTitle = planRow.title
            .replace(/[^a-zA-Z0-9_\-\s]/g, "")
            .trim();
          await generatePdfFromElement(
            templateRef.current,
            `${safeTitle || "plan"}.pdf`,
          );
        }
      } finally {
        // 6 — Cleanup
        setPdfData(null);
        setIsExporting(false);
      }
    },
    [isExporting],
  );

  return { templateRef, pdfData, isExporting, exportPDF };
}
