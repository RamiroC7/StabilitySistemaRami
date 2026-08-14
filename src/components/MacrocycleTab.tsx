import { useState, useRef, useEffect } from "react";
import jsPDF from "jspdf";
import {
  useMacrocycle,
  useMacrocycleObjectives,
  macrocycleMonthDate,
  monthName,
  type Macrocycle,
  type MacrocycleObjective,
  type MacrocycleMonth,
  type MacrocycleWeek,
} from "@/hooks/useMacrocycle";

// ── Constants ──────────────────────────────────────────────────────────────

const MAX_WEEK_WORDS = 30;

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

// ── Objectives Manager Modal ───────────────────────────────────────────────

function ObjectivesManagerModal({ onClose }: { onClose: () => void }) {
  const {
    objectives,
    loading,
    createObjective,
    updateObjective,
    deleteObjective,
  } = useMacrocycleObjectives();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3B82F6");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    await createObjective(newName, newColor);
    setNewName("");
    setNewColor("#3B82F6");
    setSaving(false);
  }

  function startEdit(obj: MacrocycleObjective) {
    setEditingId(obj.id);
    setEditName(obj.name);
    setEditColor(obj.color);
  }

  async function handleUpdate() {
    if (!editingId) return;
    setSaving(true);
    await updateObjective(editingId, { name: editName, color: editColor });
    setEditingId(null);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteObjective(id);
    setDeletingId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-violet-600 dark:text-violet-400 filled">
                tune
              </span>
            </div>
            Gestionar Objetivos
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {loading ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              Cargando...
            </div>
          ) : objectives.length === 0 ? (
            <div className="py-6 text-center text-slate-400 text-sm">
              Sin objetivos creados aún.
            </div>
          ) : (
            objectives.map((obj) => (
              <div
                key={obj.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
              >
                {editingId === obj.id ? (
                  <>
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-8 h-8 rounded-lg border-0 cursor-pointer shrink-0"
                    />
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <button
                      onClick={handleUpdate}
                      disabled={saving}
                      className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        close
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <div
                      className="w-4 h-4 rounded-full shrink-0"
                      style={{ backgroundColor: obj.color }}
                    />
                    <span className="flex-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {obj.name}
                    </span>
                    <button
                      onClick={() => startEdit(obj)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => handleDelete(obj.id)}
                      disabled={deletingId === obj.id}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      {deletingId === obj.id ? (
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">
                          delete
                        </span>
                      )}
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Create new */}
        <div className="p-5 border-t border-slate-200 dark:border-slate-700">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">
            Nuevo objetivo
          </p>
          <div className="flex gap-2">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-10 h-10 rounded-xl border border-slate-300 dark:border-slate-600 cursor-pointer shrink-0"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del objetivo..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="flex-1 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newName.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
            >
              {saving ? "..." : "Agregar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Week textarea ──────────────────────────────────────────────────────────

function WeekField({
  week,
  onSave,
}: {
  week: MacrocycleWeek;
  onSave: (weekId: string, notes: string) => Promise<void>;
}) {
  const [value, setValue] = useState(week.notes);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if external data changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(week.notes);
  }, [week.notes]);

  function handleChange(text: string) {
    const words = text.trim() === "" ? [] : text.trim().split(/\s+/);
    if (words.length > MAX_WEEK_WORDS) return;
    setValue(text);

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setIsSaving(true);
      await onSave(week.id, text);
      setIsSaving(false);
    }, 800);
  }

  const count = wordCount(value);
  const isNearLimit = count >= MAX_WEEK_WORDS - 5;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">
          Semana {week.week_number}
        </p>
        <div className="flex items-center gap-1.5">
          {isSaving && (
            <span className="text-[10px] text-slate-400 italic">
              guardando...
            </span>
          )}
          <span
            className={`text-[10px] font-semibold ${
              isNearLimit ? "text-amber-500" : "text-slate-400"
            }`}
          >
            {count}/{MAX_WEEK_WORDS}
          </span>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        rows={2}
        placeholder="Descripción de la semana..."
        className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-slate-800 dark:text-slate-200 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
      />
    </div>
  );
}

// ── PDF Export ────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

async function loadImageAsDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // If it's an SVG, convert it to a PNG data URL using canvas for jsPDF compatibility
    if (src.endsWith(".svg") || blob.type === "image/svg+xml") {
      return await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || 300;
          canvas.height = img.naturalHeight || 300;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/png"));
          } else {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    return dataUrl;
  } catch {
    return null;
  }
}

async function exportMacrocyclePDF(
  macrocycle: Macrocycle,
  objectives: MacrocycleObjective[],
  studentName: string,
  cycleNumber: number,
  totalCycles: number,
) {
  const doc = new jsPDF();
  const PAGE_WIDTH = doc.internal.pageSize.getWidth();
  const PAGE_HEIGHT = doc.internal.pageSize.getHeight();
  const MARGIN = 14;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const startDate = macrocycle.start_date;
  const startMonthDate = macrocycleMonthDate(startDate, 0);
  const endMonthDate = macrocycleMonthDate(startDate, 5);
  const rangeLabel = `${monthName(startMonthDate)} ${startMonthDate.getFullYear()} — ${monthName(endMonthDate)} ${endMonthDate.getFullYear()}`;

  // Load logo
  const logoDataUrl = await loadImageAsDataUrl("/logo-nuevo-confondo.svg");

  let y = 0;

  // ── Header band ─────────────────────────────────────────────────────────
  // Dark blue gradient simulation: two rectangles side by side
  const HEADER_H = 32;
  doc.setFillColor(29, 78, 216); // #1d4ed8
  doc.rect(0, y, PAGE_WIDTH * 0.55, HEADER_H, "F");
  doc.setFillColor(30, 64, 175); // #1e40af
  doc.rect(PAGE_WIDTH * 0.55, y, PAGE_WIDTH * 0.45, HEADER_H, "F");
  // Blend strip in the middle for a softer transition
  doc.setFillColor(29, 70, 195);
  doc.rect(PAGE_WIDTH * 0.45, y, PAGE_WIDTH * 0.2, HEADER_H, "F");

  // Logo (left side)
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", MARGIN, y + 4, 24, 24);
  }

  // "Macrociclo" label (right-aligned, small caps)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(191, 219, 254); // #bfdbfe
  const docLabel = "MACROCICLO DE ENTRENAMIENTO";
  doc.text(docLabel, PAGE_WIDTH - MARGIN - doc.getTextWidth(docLabel), y + 10);

  // Student name (right-aligned, large)
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(
    studentName,
    PAGE_WIDTH - MARGIN - doc.getTextWidth(studentName),
    y + 20,
  );

  // Cycle info (right-aligned, small)
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(147, 197, 253); // #93c5fd
  const cycleInfo = `Ciclo ${cycleNumber} de ${totalCycles}`;
  doc.text(
    cycleInfo,
    PAGE_WIDTH - MARGIN - doc.getTextWidth(cycleInfo),
    y + 28,
  );

  y += HEADER_H;

  // ── Info band ────────────────────────────────────────────────────────────
  const INFO_H = 18;
  doc.setFillColor(239, 246, 255); // #eff6ff
  doc.rect(0, y, PAGE_WIDTH, INFO_H, "F");
  doc.setDrawColor(191, 219, 254); // #bfdbfe
  doc.line(0, y + INFO_H, PAGE_WIDTH, y + INFO_H);

  // Período column
  const COL1_X = MARGIN;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128); // gray
  doc.text("PERÍODO", COL1_X, y + 6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138); // #1e3a8a
  doc.text(rangeLabel, COL1_X, y + 13);

  // Divider
  doc.setDrawColor(191, 219, 254);
  doc.line(PAGE_WIDTH * 0.6, y + 3, PAGE_WIDTH * 0.6, y + INFO_H - 3);

  // Duración column
  const COL2_X = PAGE_WIDTH * 0.62;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(107, 114, 128);
  doc.text("DURACIÓN", COL2_X, y + 6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text("6 meses · 24 semanas", COL2_X, y + 13);

  y += INFO_H + 8;

  // ── Objectives legend ────────────────────────────────────────────────────
  const usedObjectiveIds = new Set(
    macrocycle.months
      .filter((m) => m.objective_id !== null)
      .map((m) => m.objective_id as string),
  );
  const usedObjectives = objectives.filter((o) => usedObjectiveIds.has(o.id));

  if (usedObjectives.length > 0) {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text("OBJETIVOS DEL CICLO", MARGIN, y);
    y += 5;

    let legendX = MARGIN;
    for (const obj of usedObjectives) {
      const [r, g, b] = hexToRgb(obj.color);
      doc.setFillColor(r, g, b);
      doc.roundedRect(legendX, y - 3.5, 3.5, 4.5, 1, 1, "F");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(30, 41, 59);
      doc.text(obj.name, legendX + 6, y);
      legendX += doc.getTextWidth(obj.name) + 14;
    }
    y += 7;

    doc.setDrawColor(219, 234, 254); // #dbeafe
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y);
    y += 6;
  }

  // ── Month sections ───────────────────────────────────────────────────────
  for (const month of macrocycle.months) {
    const monthDate = macrocycleMonthDate(startDate, month.month_index);
    const mName = monthName(monthDate);
    const mYear = monthDate.getFullYear();
    const objective = month.objective;

    const MONTH_HEADER_H = 11;
    const COL_W = (CONTENT_WIDTH - 6) / 2;

    // Estimate total month block height
    const sortedWeeks = [...month.weeks].sort(
      (a, b) => a.week_number - b.week_number,
    );
    const leftWeeks = sortedWeeks.filter((_, i) => i % 2 === 0);
    const rightWeeks = sortedWeeks.filter((_, i) => i % 2 === 1);
    const rows = Math.max(leftWeeks.length, rightWeeks.length);

    const rowHeights: number[] = [];
    for (let row = 0; row < rows; row++) {
      let rh = 14;
      for (const week of [leftWeeks[row], rightWeeks[row]]) {
        if (week?.notes) {
          const lines = doc.splitTextToSize(week.notes, COL_W - 10);
          rh = Math.max(rh, lines.length * 4.5 + 11);
        }
      }
      rowHeights.push(rh);
    }
    const totalWeeksH = rowHeights.reduce((a, b) => a + b + 3, 0);
    const blockHeight = MONTH_HEADER_H + totalWeeksH + 8;

    if (y + blockHeight > PAGE_HEIGHT - 18) {
      doc.addPage();
      y = 14;
    }

    // Month header — light blue background (matches plan PDF table header)
    doc.setFillColor(239, 246, 255); // #eff6ff
    doc.setDrawColor(191, 219, 254); // #bfdbfe
    doc.roundedRect(MARGIN, y, CONTENT_WIDTH, MONTH_HEADER_H, 2, 2, "FD");

    // Color stripe on left
    const [r, g, b] = hexToRgb(objective?.color ?? "#CBD5E1");
    doc.setFillColor(r, g, b);
    doc.roundedRect(MARGIN, y, 5, MONTH_HEADER_H, 1, 1, "F");

    // Month name
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 58, 138); // #1e3a8a
    doc.text(`${mName} ${mYear}`, MARGIN + 9, y + 7.5);

    // Month index pill
    const idxText = `Mes ${month.month_index + 1}`;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(
      idxText,
      MARGIN + 9 + doc.getTextWidth(`${mName} ${mYear}`) + 4,
      y + 7.5,
    );

    // Objective badge (right-aligned)
    if (objective) {
      const badgeText = objective.name;
      doc.setFontSize(8);
      const badgeWidth = doc.getTextWidth(badgeText) + 8;
      const [br, bg, bb] = hexToRgb(objective.color);
      doc.setFillColor(br, bg, bb);
      doc.roundedRect(
        PAGE_WIDTH - MARGIN - badgeWidth - 2,
        y + 2,
        badgeWidth,
        7,
        2,
        2,
        "F",
      );
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text(badgeText, PAGE_WIDTH - MARGIN - badgeWidth + 2, y + 7.5);
    }

    y += MONTH_HEADER_H + 3;

    // Weeks grid — 2 columns
    for (let row = 0; row < rows; row++) {
      const cols = [
        { week: leftWeeks[row], x: MARGIN },
        { week: rightWeeks[row], x: MARGIN + COL_W + 6 },
      ].filter((c) => c.week !== undefined);

      const rowHeight = rowHeights[row];

      if (y + rowHeight > PAGE_HEIGHT - 18) {
        doc.addPage();
        y = 14;
      }

      for (const { week, x } of cols) {
        // Cell: white bg, blue border (like plan PDF table rows)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(219, 234, 254); // #dbeafe
        doc.roundedRect(x, y, COL_W, rowHeight, 2, 2, "FD");

        // Week label in blue (like plan PDF header labels)
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 64, 175); // #1e40af
        doc.text(`SEMANA ${week.week_number}`, x + 5, y + 5.5);

        // Notes
        if (week.notes) {
          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 65, 81); // #374151
          doc.setFontSize(9);
          const lines = doc.splitTextToSize(week.notes, COL_W - 10);
          doc.text(lines, x + 5, y + 11.5);
        } else {
          doc.setFont("helvetica", "italic");
          doc.setTextColor(191, 219, 254); // #bfdbfe
          doc.setFontSize(8.5);
          doc.text("Sin descripción", x + 5, y + 11.5);
        }
      }

      y += rowHeight + 3;
    }

    y += 6;
  }

  // ── Footer on all pages ──────────────────────────────────────────────────
  const pageCount = (
    doc.internal as unknown as { getNumberOfPages: () => number }
  ).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer band
    doc.setFillColor(248, 250, 252);
    doc.rect(0, PAGE_HEIGHT - 12, PAGE_WIDTH, 12, "F");
    doc.setDrawColor(219, 234, 254);
    doc.line(0, PAGE_HEIGHT - 12, PAGE_WIDTH, PAGE_HEIGHT - 12);
    // Footer text
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    const generated = `Generado el ${new Date().toLocaleDateString("es-AR")} · Stability`;
    const pageLabel = `Pág. ${i} / ${pageCount}`;
    doc.text(generated, MARGIN, PAGE_HEIGHT - 5);
    doc.text(
      pageLabel,
      PAGE_WIDTH - MARGIN - doc.getTextWidth(pageLabel),
      PAGE_HEIGHT - 5,
    );
  }

  const safeName = studentName
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, "");
  doc.save(`macrociclo_${safeName}_ciclo${cycleNumber}.pdf`);
}

// ── Month card ─────────────────────────────────────────────────────────────

function MonthCard({
  month,
  startDate,
  objectives,
  onObjectiveChange,
  onWeekSave,
}: {
  month: MacrocycleMonth;
  startDate: string;
  objectives: MacrocycleObjective[];
  onObjectiveChange: (
    monthId: string,
    objectiveId: string | null,
  ) => Promise<void>;
  onWeekSave: (weekId: string, notes: string) => Promise<void>;
}) {
  const date = macrocycleMonthDate(startDate, month.month_index);
  const name = monthName(date);
  const year = date.getFullYear();
  const objective = month.objective;

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-10 rounded-full shrink-0"
            style={{ backgroundColor: objective?.color ?? "#CBD5E1" }}
          />
          <div>
            <p className="text-base font-bold text-slate-900 dark:text-white capitalize">
              {name} {year}
            </p>
            <p className="text-[11px] text-slate-400 font-medium">
              Mes {month.month_index + 1} del macrociclo
            </p>
          </div>
        </div>

        {/* Objective selector */}
        <div className="flex items-center gap-2">
          {objective && (
            <span
              className="hidden sm:inline text-xs font-bold px-2.5 py-1 rounded-full text-white"
              style={{ backgroundColor: objective.color }}
            >
              {objective.name}
            </span>
          )}
          <select
            value={month.objective_id ?? ""}
            onChange={(e) =>
              onObjectiveChange(month.id, e.target.value || null)
            }
            className="text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
          >
            <option value="">Sin objetivo</option>
            {objectives.map((obj) => (
              <option key={obj.id} value={obj.id}>
                {obj.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weeks */}
      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {month.weeks.map((week) => (
          <WeekField key={week.id} week={week} onSave={onWeekSave} />
        ))}
      </div>
    </div>
  );
}

// ── Macrocycle Preview ───────────────────────────────────────────────────────

function MacrocyclePreview({ macrocycle }: { macrocycle: Macrocycle }) {
  const startDate = macrocycle.start_date;

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-sm text-center">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700">
            {macrocycle.months.map((month) => {
              const date = macrocycleMonthDate(startDate, month.month_index);
              const mName = monthName(date);
              return (
                <th
                  key={month.id}
                  className="py-3 px-2 font-bold text-slate-800 dark:text-slate-200 capitalize w-1/6 border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                >
                  {mName}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            {macrocycle.months.map((month) => (
              <td
                key={month.id}
                className="py-3 px-2 font-semibold text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-700 last:border-r-0"
                style={{
                  color: month.objective?.color || undefined,
                }}
              >
                {month.objective?.name || "Sin objetivo"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main MacrocycleTab ─────────────────────────────────────────────────────

export function MacrocycleTab({
  studentId,
  studentCreatedAt,
  studentName,
}: {
  studentId: string;
  studentCreatedAt: string;
  studentName: string;
}) {
  const {
    macrocycles,
    activeMacrocycle,
    currentIndex,
    setCurrentIndex,
    loading,
    addNextMacrocycle,
    deleteMacrocycle,
    updateMonthObjective,
    updateWeekNotes,
  } = useMacrocycle(studentId, studentCreatedAt);

  const { objectives } = useMacrocycleObjectives();
  const [showObjectivesManager, setShowObjectivesManager] = useState(false);
  const [addingNext, setAddingNext] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exportingPDF, setExportingPDF] = useState(false);

  async function handleAddNext() {
    setAddingNext(true);
    await addNextMacrocycle();
    setAddingNext(false);
  }

  async function handleDelete() {
    if (!activeMacrocycle) return;
    setDeleting(true);
    await deleteMacrocycle(activeMacrocycle.id);
    setDeleting(false);
    setConfirmDelete(false);
  }

  function handleExportPDF() {
    if (!activeMacrocycle) return;
    setExportingPDF(true);
    exportMacrocyclePDF(
      activeMacrocycle,
      objectives,
      studentName,
      currentIndex + 1,
      macrocycles.length,
    ).finally(() => setExportingPDF(false));
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-card-dark rounded-2xl border border-slate-200 dark:border-slate-700 h-52"
          />
        ))}
      </div>
    );
  }

  if (!activeMacrocycle) {
    return (
      <div className="text-center py-16">
        <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-3 block">
          warning
        </span>
        <p className="text-slate-500 text-sm font-medium">
          No se pudo cargar el macrociclo.
        </p>
        <p className="text-slate-400 text-xs mt-1">
          Revisá la consola del navegador para más detalles.
        </p>
      </div>
    );
  }

  const startDate = activeMacrocycle.start_date;
  const endMonthDate = macrocycleMonthDate(startDate, 5);
  const rangeLabel = `${monthName(macrocycleMonthDate(startDate, 0))} ${new Date(startDate + "T00:00:00").getFullYear()} — ${monthName(endMonthDate)} ${endMonthDate.getFullYear()}`;

  return (
    <div className="space-y-5">
      {/* ── Header bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
            disabled={currentIndex === 0}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              chevron_left
            </span>
          </button>

          <div className="text-center px-2">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              {rangeLabel}
            </p>
            <p className="text-[11px] text-slate-400">
              Macrociclo {currentIndex + 1} de {macrocycles.length}
            </p>
          </div>

          <button
            onClick={() =>
              setCurrentIndex(
                Math.min(macrocycles.length - 1, currentIndex + 1),
              )
            }
            disabled={currentIndex === macrocycles.length - 1}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              chevron_right
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exportingPDF}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">
              picture_as_pdf
            </span>
            {exportingPDF ? "Exportando..." : "Exportar PDF"}
          </button>

          <button
            onClick={() => setShowObjectivesManager(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-primary hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Objetivos
          </button>

          {macrocycles.length > 1 && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border border-red-200 dark:border-red-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">
                delete
              </span>
              Borrar ciclo
            </button>
          )}

          {currentIndex === macrocycles.length - 1 && (
            <button
              onClick={handleAddNext}
              disabled={addingNext}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {addingNext ? "Creando..." : "Nuevo ciclo"}
            </button>
          )}
        </div>
      </div>

      {/* ── Preview Table ── */}
      <MacrocyclePreview macrocycle={activeMacrocycle} />

      {/* ── Month cards ── */}
      <div className="space-y-4">
        {activeMacrocycle.months.map((month) => (
          <MonthCard
            key={month.id}
            month={month}
            startDate={startDate}
            objectives={objectives}
            onObjectiveChange={updateMonthObjective}
            onWeekSave={updateWeekNotes}
          />
        ))}
      </div>

      {/* Objectives manager modal */}
      {showObjectivesManager && (
        <ObjectivesManagerModal
          onClose={() => setShowObjectivesManager(false)}
        />
      )}

      {/* Delete macrocycle confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleting && setConfirmDelete(false)}
          />
          <div className="relative bg-white dark:bg-card-dark rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[22px] text-red-500 filled">
                  delete
                </span>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Borrar macrociclo
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  ¿Estás seguro? Se eliminarán todos los meses, semanas y
                  objetivos asignados de este ciclo. Esta acción no se puede
                  deshacer.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
              >
                {deleting ? "Borrando..." : "Sí, borrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
