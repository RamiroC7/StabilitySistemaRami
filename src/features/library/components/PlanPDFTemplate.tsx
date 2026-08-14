import React from "react";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface PdfExercise {
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

export interface PdfDay {
  id: string;
  day_number: number;
  day_name: string;
  display_order: number;
  training_plan_exercises: PdfExercise[];
}

export interface PlanPDFData {
  title: string;
  created_at: string;
  start_date: string;
  end_date: string;
  total_weeks: number;
  days_per_week: number;
  days: PdfDay[];
  studentNames?: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function fmtShortDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────────────────────────────────────

function ExerciseTable({ exercises }: { exercises: PdfExercise[] }) {
  if (exercises.length === 0) {
    return (
      <p
        style={{
          color: "#94a3b8",
          fontSize: 11,
          padding: "8px 0",
          fontStyle: "italic",
        }}
      >
        Sin ejercicios asignados
      </p>
    );
  }

  const colStyle: React.CSSProperties = {
    padding: "6px 8px",
    fontSize: 10,
    textAlign: "center",
    color: "#374151",
    borderBottom: "1px solid #dbeafe",
  };

  const headerStyle: React.CSSProperties = {
    padding: "7px 8px",
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    textAlign: "center",
    color: "#1e40af",
    backgroundColor: "#eff6ff",
    borderBottom: "2px solid #bfdbfe",
  };

  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 10,
      }}
    >
      <thead>
        <tr>
          <th style={{ ...headerStyle, textAlign: "left", width: "90px" }}>
            Etapa
          </th>
          <th style={{ ...headerStyle, width: "28px" }}>#</th>
          <th style={{ ...headerStyle, textAlign: "left" }}>Ejercicio</th>
          <th style={{ ...headerStyle, width: "44px" }}>Series</th>
          <th style={{ ...headerStyle, width: "44px" }}>Reps</th>
          <th style={{ ...headerStyle, width: "50px" }}>Carga</th>
          <th style={{ ...headerStyle, width: "44px" }}>Pausa</th>
          <th style={{ ...headerStyle, textAlign: "left" }}>Notas</th>
        </tr>
      </thead>
      <tbody>
        {exercises.map((ex, i) => {
          const isEven = i % 2 === 0;
          const rowBg = isEven ? "#ffffff" : "#f8fafc";
          return (
            <tr key={ex.id} style={{ backgroundColor: rowBg }}>
              <td style={{ ...colStyle, textAlign: "left" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 6px",
                    backgroundColor: "#dbeafe",
                    color: "#1d4ed8",
                    borderRadius: 4,
                    fontSize: 9,
                    fontWeight: 600,
                    border: "1px solid #bfdbfe",
                  }}
                >
                  {ex.stage_name}
                </span>
              </td>
              <td style={{ ...colStyle }}>{i + 1}</td>
              <td
                style={{
                  ...colStyle,
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#111827",
                }}
              >
                {ex.exercise_name}
              </td>
              <td style={{ ...colStyle }}>{ex.series || "—"}</td>
              <td style={{ ...colStyle }}>{ex.reps || "—"}</td>
              <td style={{ ...colStyle, fontWeight: 600, color: "#1d4ed8" }}>
                {ex.carga || "—"}
              </td>
              <td style={{ ...colStyle }}>{ex.pause || "sin descanso"}</td>
              <td
                style={{
                  ...colStyle,
                  textAlign: "left",
                  color: "#6b7280",
                  fontStyle: ex.notes ? "normal" : "italic",
                }}
              >
                {ex.notes || "—"}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Template Component
// ──────────────────────────────────────────────────────────────────────────────

interface PlanPDFTemplateProps {
  data: PlanPDFData;
}

const PlanPDFTemplate = React.forwardRef<HTMLDivElement, PlanPDFTemplateProps>(
  ({ data }, ref) => {
    const sortedDays = [...data.days].sort(
      (a, b) => a.display_order - b.display_order,
    );

    return (
      <div
        ref={ref}
        style={{
          width: 794,
          backgroundColor: "#ffffff",
          fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
          color: "#1e293b",
        }}
      >
        {/* ── HEADER ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
            padding: "28px 36px 22px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src="/logo-nuevo-confondo.svg"
              alt="Stability"
              crossOrigin="anonymous"
              style={{ height: 48, width: "auto", objectFit: "contain" }}
            />
          </div>

          {/* Title block */}
          <div style={{ textAlign: "right" }}>
            <p
              style={{
                color: "#bfdbfe",
                fontSize: 10,
                margin: 0,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              Plan de Entrenamiento
            </p>
            <h1
              style={{
                color: "#ffffff",
                fontSize: 20,
                fontWeight: 800,
                margin: "4px 0 0",
                maxWidth: 380,
                lineHeight: 1.25,
              }}
            >
              {data.title}
            </h1>
          </div>
        </div>

        {/* ── INFO CARDS ── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            backgroundColor: "#eff6ff",
            borderBottom: "2px solid #bfdbfe",
          }}
        >
          {/* Students */}
          <div
            style={{
              flex: 2,
              padding: "14px 20px",
              borderRight: "1px solid #bfdbfe",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: "#6b7280",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              {data.studentNames && data.studentNames.length > 1
                ? "Alumnos"
                : "Alumno"}
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#1e3a8a",
                margin: "3px 0 0",
                lineHeight: 1.4,
              }}
            >
              {data.studentNames && data.studentNames.length > 0
                ? data.studentNames.join(", ")
                : "Sin asignar"}
            </p>
          </div>

          {/* Dates */}
          <div
            style={{
              flex: 2,
              padding: "14px 20px",
              borderRight: "1px solid #bfdbfe",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: "#6b7280",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              Plazo
            </p>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#1e3a8a",
                margin: "3px 0 0",
              }}
            >
              {fmtShortDate(data.start_date)} → {fmtShortDate(data.end_date)}
            </p>
          </div>

          {/* Meta */}
          <div style={{ flex: 1, padding: "14px 20px" }}>
            <p
              style={{
                fontSize: 9,
                color: "#6b7280",
                margin: 0,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                fontWeight: 600,
              }}
            >
              Duración
            </p>
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1e3a8a",
                margin: "3px 0 0",
              }}
            >
              {data.total_weeks} sem · {data.days_per_week} días/sem
            </p>
          </div>
        </div>

        {/* ── WATERMARK META ── */}
        <div
          style={{
            padding: "6px 24px",
            backgroundColor: "#f8fafc",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>
            Creado el {fmtDate(data.created_at)}
          </p>
          <p style={{ fontSize: 9, color: "#94a3b8", margin: 0 }}>
            Generado por Stability · plataforma de entrenamiento
          </p>
        </div>

        {/* ── DAYS ── */}
        <div style={{ padding: "16px 24px 32px" }}>
          {sortedDays.map((day) => {
            const exercises = [...(day.training_plan_exercises || [])].sort(
              (a, b) => a.display_order - b.display_order,
            );
            return (
              <div
                key={day.id}
                style={{
                  marginBottom: 20,
                  border: "1px solid #bfdbfe",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {/* Day header */}
                <div
                  style={{
                    backgroundColor: "#1d4ed8",
                    padding: "9px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <h2
                    style={{
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: 700,
                      margin: 0,
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {day.day_name}
                  </h2>
                  <span
                    style={{
                      color: "#bfdbfe",
                      fontSize: 10,
                      fontWeight: 500,
                    }}
                  >
                    {exercises.length} ejercicio
                    {exercises.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Exercise table */}
                <div style={{ padding: "0 0 4px" }}>
                  <ExerciseTable exercises={exercises} />
                </div>
              </div>
            );
          })}

          {sortedDays.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "40px 0",
                color: "#9ca3af",
                fontSize: 12,
              }}
            >
              Este plan no tiene días configurados.
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            borderTop: "2px solid #bfdbfe",
            padding: "12px 24px",
            backgroundColor: "#eff6ff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ fontSize: 9, color: "#6b7280", margin: 0 }}>
            © {new Date().getFullYear()} Stability — Todos los derechos
            reservados
          </p>
          <p style={{ fontSize: 9, color: "#6b7280", margin: 0 }}>
            {data.studentNames && data.studentNames.length > 0
              ? `Plan de ${data.studentNames.join(", ")}`
              : data.title}
          </p>
        </div>
      </div>
    );
  },
);

PlanPDFTemplate.displayName = "PlanPDFTemplate";

export default PlanPDFTemplate;
