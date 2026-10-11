import { useNavigate } from "react-router-dom";
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";
import { useStudents, getStudentTag, type Student } from "../../hooks/useStudents";
import { detectRpeAlert } from "@/lib/rpeHelpers";
import { avatarSrc, DEFAULT_AVATAR } from "@/lib/avatar";

// ── Avatar: miniatura transformada + skeleton + fallback ───────────────────
// R7/R9: las fotos originales pesan ~1,6 MB; se pide la miniatura al tamano real.
// Si la imagen ya estaba en cache del navegador se muestra sin fade (sin parpadeo)
// y si falla la carga se cae a la imagen predeterminada en vez de dejar el skeleton para siempre.
function StudentAvatar({ src, alt, isArchived }: { src: string | null; alt: string; isArchived: boolean }) {
  const [useOriginal, setUseOriginal] = useState(false);
  const url = useOriginal && src ? src : avatarSrc(src, 56);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [prevUrl, setPrevUrl] = useState<string | null>(url);

  if (url !== prevUrl) {
    setPrevUrl(url);
    setStatus("loading");
  }

  // Si la imagen ya esta decodificada (cache), marcarla cargada antes del primer paint.
  const imgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setStatus("loaded");
  }, []);
  const handleLoad = useCallback(() => setStatus("loaded"), []);
  // Si la miniatura falla (ej. transformacion no disponible) se reintenta una vez
  // con la foto original antes de caer a la imagen predeterminada.
  const handleError = useCallback(() => {
    if (!useOriginal && src && avatarSrc(src, 56) !== src) setUseOriginal(true);
    else setStatus("error");
  }, [useOriginal, src]);

  return (
    <div
      className={`relative h-14 w-14 rounded-full flex-shrink-0 ring-2 ring-gray-100 dark:ring-gray-700 shadow-sm overflow-hidden transition-transform duration-300 ${
        !isArchived ? "group-hover:scale-105" : ""
      }`}
    >
      {status !== "error" ? (
        <>
          {status === "loading" && (
            <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
          )}
          <img
            ref={imgRef}
            src={url}
            alt={alt}
            width={56}
            height={56}
            loading="lazy"
            decoding="async"
            onLoad={handleLoad}
            onError={handleError}
            className={`h-full w-full object-cover rounded-full ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
          />
        </>
      ) : (
        <img
          src={DEFAULT_AVATAR}
          alt={alt}
          width={56}
          height={56}
          className="h-full w-full object-cover rounded-full"
        />
      )}
    </div>
  );
}

// ── Tarjeta de alumno ──────────────────────────────────────────────────────
// Memoizada (regla R12 de rendimiento-stability): al llegar las alertas RPE o
// escribir en el buscador solo se re-renderizan las tarjetas cuyas props
// cambian, no toda la grilla.
interface StudentCardProps {
  student: Student;
  attendance: number | undefined;
  rpeAlert: "high" | "low" | null | undefined;
  onOpen: (studentId: string) => void;
}

const StudentCard = memo(function StudentCard({
  student,
  attendance,
  rpeAlert,
  onOpen,
}: StudentCardProps) {
  const isArchived = student.isArchived;
  const showAttendanceAlert =
    attendance !== undefined && attendance < 65 && !isArchived;

  return (
    <div
      onClick={() => onOpen(student.id)}
      className={`group bg-white dark:bg-card-dark rounded-xl p-4 shadow-sm transition-all duration-300 border cursor-pointer ${isArchived
        ? "opacity-60 border-gray-300 dark:border-gray-600 hover:opacity-80"
        : "border-gray-200 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-900/30 hover:shadow-md"
        }`}
    >
      {/* Horizontal Card Layout */}
      <div className="flex flex-row items-center justify-between gap-3">
        {/* Left: Avatar */}
        <StudentAvatar
          src={student.profileImageUrl}
          alt={student.fullName}
          isArchived={isArchived}
        />

        {/* Center: Name, Tag, Plan & Alerts */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          {/* Name */}
          <h3 className="text-base font-bold text-gray-900 dark:text-white truncate">
            {student.fullName}
          </h3>

          {/* Tag */}
          <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">
            {getStudentTag(
              student.trainingLevel,
              student.primaryGoal,
            )}
          </p>

          {/* Badges: Plan, Alerts, Archived */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Plan Status */}
            {!student.activeAssignments ||
              student.activeAssignments.length === 0 ? (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                <span className="material-symbols-outlined text-[12px]">
                  assignment_late
                </span>
                <span className="text-[10px] font-semibold whitespace-nowrap">
                  Sin plan
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                <span className="material-symbols-outlined text-[12px] text-blue-600 dark:text-blue-400">
                  assignment_turned_in
                </span>
                <span
                  className="text-[10px] font-semibold text-blue-700 dark:text-blue-300 truncate max-w-[120px]"
                  title={student.activeAssignments[0].plan_title}
                >
                  {student.activeAssignments[0].plan_title}
                </span>
              </div>
            )}

            {/* Attendance Alert */}
            {showAttendanceAlert && (
              <div className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                <span className="material-symbols-outlined text-[12px]">
                  event_busy
                </span>
                <span className="whitespace-nowrap">
                  {attendance}%
                </span>
              </div>
            )}

            {/* RPE Alert */}
            {rpeAlert && !isArchived && (
              <div
                className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${rpeAlert === "high"
                  ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800"
                  : "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                  }`}
              >
                <span className="material-symbols-outlined text-[12px]">
                  {rpeAlert === "high"
                    ? "warning"
                    : "info"}
                </span>
                <span className="whitespace-nowrap">
                  {rpeAlert === "high"
                    ? "RPE Alto"
                    : "RPE Bajo"}
                </span>
              </div>
            )}

            {/* Archived Badge */}
            {isArchived && (
              <div className="flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600">
                <span className="material-symbols-outlined text-[12px]">
                  archive
                </span>
                <span className="whitespace-nowrap">
                  Archivado
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen(student.id);
          }}
          className={`flex items-center justify-center p-2 rounded-lg transition-colors border flex-shrink-0 ${isArchived
            ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-primary dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700"
            }`}
          title="Ver Perfil"
        >
          <span className="material-symbols-outlined text-[20px]">
            chevron_right
          </span>
        </button>
      </div>
    </div>
  );
});

export default function StudentsList() {
  const { students, loading, error } = useStudents();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [rpeAlerts, setRpeAlerts] = useState<
    Map<string, "high" | "low" | null>
  >(new Map());
  const [attendanceAlerts, setAttendanceAlerts] = useState<Map<string, number>>(
    new Map(),
  );

  // El filtrado usa el valor "diferido": el input responde al instante y la
  // grilla se actualiza con prioridad baja (regla R13).
  const deferredQuery = useDeferredValue(searchQuery);

  // Filtrar por busqueda + activos primero / archivados al final. Memoizado:
  // solo se recalcula si cambian los alumnos o el texto buscado.
  const visibleStudents = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    const filtered = query
      ? students.filter((s) => s.fullName.toLowerCase().includes(query))
      : students;
    return [...filtered].sort((a, b) => {
      if (!a.isArchived && b.isArchived) return -1;
      if (a.isArchived && !b.isArchived) return 1;
      return 0;
    });
  }, [students, deferredQuery]);

  // Callback estable para que StudentCard (memo) no se re-renderice de mas.
  const openStudent = useCallback(
    (studentId: string) => navigate(`/alumno/${studentId}`),
    [navigate],
  );

  // Load RPE and Attendance alerts for each student
  // Two batched queries for ALL students instead of N×2 individual queries
  useEffect(() => {
    if (students.length === 0) return;

    const loadAlerts = async () => {
      const today = new Date();
      const currentDayOfWeek = today.getDay(); // 0 is Sunday, 1 is Monday
      const daysSinceMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;

      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - daysSinceMonday);
      thisMonday.setHours(0, 0, 0, 0);

      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);

      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      lastSunday.setHours(23, 59, 59, 999);

      // Un solo RPC en el servidor (regla R19/R20): ultimos 3 RPE y asistencia de
      // la semana pasada por alumno. Antes se bajaban TODAS las completions de
      // TODOS los alumnos (sin limite, PostgREST corta en 1.000 filas).
      const { data: alertRows, error: alertsError } = await supabase.rpc(
        "get_students_alerts",
        {
          p_week_start: lastMonday.toISOString(),
          p_week_end: lastSunday.toISOString(),
        },
      );
      if (alertsError || !alertRows) return;

      const alertsByStudent = new Map(
        (
          alertRows as {
            student_id: string;
            recent_rpes: (number | null)[] | null;
            last_week_count: number;
          }[]
        ).map((row) => [row.student_id, row]),
      );

      // RPE: detectar alerta con los ultimos 3 de cada alumno
      const newRpeAlerts = new Map<string, "high" | "low" | null>();
      for (const student of students) {
        const rpes = alertsByStudent.get(student.id)?.recent_rpes ?? [];
        newRpeAlerts.set(
          student.id,
          rpes.length > 0 ? detectRpeAlert(rpes) : null,
        );
      }

      // Process attendance: count per student, calculate percentage
      const newAttendanceAlerts = new Map<string, number>();
      for (const student of students) {
        if (student.isArchived) continue;
        const completionsLastWeek =
          alertsByStudent.get(student.id)?.last_week_count ?? 0;
        let totalExpectedDays = 0;

        if (student.activeAssignments) {
          for (const assignment of student.activeAssignments) {
            const assignStart = new Date(assignment.start_date + "T00:00:00");
            const assignEnd = new Date(assignment.end_date + "T00:00:00");

            if (assignEnd < lastMonday || assignStart > lastSunday) continue;

            const overlapStart =
              assignStart > lastMonday ? assignStart : lastMonday;
            const overlapEnd = assignEnd < lastSunday ? assignEnd : lastSunday;

            const overlapDays =
              Math.floor(
                (overlapEnd.getTime() - overlapStart.getTime()) /
                (1000 * 60 * 60 * 24),
              ) + 1;

            totalExpectedDays += Math.round(
              (overlapDays / 7) * assignment.days_per_week,
            );
          }
        }

        const percentage =
          totalExpectedDays > 0
            ? Math.round((completionsLastWeek / totalExpectedDays) * 100)
            : 100;

        newAttendanceAlerts.set(student.id, Math.min(percentage, 100));
      }

      setRpeAlerts(newRpeAlerts);
      setAttendanceAlerts(newAttendanceAlerts);
    };

    loadAlerts();
  }, [students]);

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark relative">
      <main className="flex-1 overflow-y-auto bg-background-light dark:bg-background-dark p-6 lg:p-8">
        <div className="w-full flex flex-col gap-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              Mis Alumnos
            </h2>
            <div className="relative w-full sm:w-72">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">
                search
              </span>
              <input
                type="text"
                placeholder="Buscar alumno..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 text-gray-900 dark:text-white placeholder-gray-400 transition-all shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-red-800 dark:text-red-200 text-sm">
                <strong>Error:</strong> {error}
              </p>
              <p className="text-red-600 dark:text-red-300 text-xs mt-2">
                Abre la consola del navegador (F12) para ver detalles completos
              </p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">
                  Cargando alumnos...
                </p>
              </div>
            </div>
          ) : visibleStudents.length === 0 ? (
            /* Empty State */
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
                  group
                </span>
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  No hay alumnos registrados
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-500">
                  Los alumnos aparecerán aquí una vez que se registren en el
                  sistema
                </p>
              </div>
            </div>
          ) : (
            /* Students Grid - 4 Columns */
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {visibleStudents.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  attendance={attendanceAlerts.get(student.id)}
                  rpeAlert={rpeAlerts.get(student.id)}
                  onOpen={openStudent}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
