// Vercel Serverless Function — chat de IA en lenguaje natural para el panel
// de administrador (coach). Corre server-side y usa el token del usuario
// logueado para respetar los permisos (RLS) de Supabase: cada coach solo ve
// sus propios datos, igual que en el resto de la app.
//
// SOLO LECTURA: la única herramienta que el modelo puede usar (consultar_tabla)
// arma un SELECT contra una lista fija de tablas permitidas. Nunca inserta,
// modifica ni borra nada.
//
// Usa la API de Gemini (Google AI Studio) como proveedor de IA en vez de la
// API de Anthropic: tiene un nivel gratuito sin tarjeta de crédito, con un
// cupo de tokens por minuto MUCHO más grande que el de Groq (antes usado acá,
// 8.000 tokens/minuto — Gemini da cientos de miles en el modelo "flash-lite"),
// que era la causa de casi todos los errores de "no puedo calcular esto" o
// "demasiadas consultas" que veníamos parchando. A cambio, Gemini permite
// menos PEDIDOS por minuto (no menos TOKENS) — por eso se mantienen los
// mismos límites de tamaño de respuesta y los mismos reintentos de antes.
import { createClient } from "@supabase/supabase-js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
// "flash-lite" es el modelo más chico/rápido de Gemini y el recomendado por
// Google para uso gratuito de alto volumen — de sobra para esta tarea
// (buscar datos y resumirlos, no razonamiento complejo).
// OJO: "gemini-2.5-flash-lite" dejó de estar disponible para cuentas nuevas
// (Google devuelve error 404 pidiendo actualizar al modelo siguiente) — se
// usa "gemini-3.5-flash-lite" en su lugar. Si en el futuro Google vuelve a
// sacar de circulación un modelo, el error trae el nombre del reemplazo
// sugerido — buscarlo en el log del servidor ("[ai-chat] Gemini error").
const GEMINI_MODEL = "gemini-3.5-flash-lite";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
// Margen de turnos para preguntas que necesitan varios pasos encadenados
// (por ejemplo: buscar a un alumno, y con eso su plan, y con eso otro dato
// más), sin dejar que se vaya a un ciclo largo. Con Gemini (mucho más margen
// de tokens que con Groq) conviene dejar algo más de aire que antes.
const MAX_TOOL_TURNS = 8;

// Tablas a las que el asistente puede acceder — cualquier otra queda bloqueada.
// Al principio "student_profiles" (teléfono, fecha de nacimiento, género,
// condiciones médicas, lesiones, etc.) estaba excluida a propósito por ser
// datos sensibles. El 5-sep-2026 Ramiro pidió explícitamente lo contrario:
// "que muestre toda la info que quiera, que no tome nada como sensible pero
// que la IA no borre ni escriba datos" — es el coach dueño de esa
// información, viendo lo mismo que ya ve en su panel. Por eso ahora SÍ está
// habilitada. Lo único que sigue (y seguirá) bloqueado sin excepción es
// escribir/modificar/borrar (ver WRITE_INTENT_RE y RESPUESTA_SOLO_LECTURA
// más abajo) — eso no cambió y no debe cambiar.
const ALLOWED_TABLES = [
  "profiles",
  "student_profiles",
  "training_plans",
  "training_plan_days",
  "training_plan_exercises",
  "training_plan_assignments",
  "workout_completions",
  "exercise_weight_logs",
  "exercise_stages",
  "plan_folders",
  // Agregadas el 5-sep-2026 a pedido de Ramiro, después de mandar el esquema
  // real de la base.
  "body_measurements",
  "workout_logs",
  "macrocycles",
  "macrocycle_months",
  "macrocycle_weeks",
  "macrocycle_objectives",
];

const ALLOWED_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in"];

// Tablas/columnas que son un id de "profiles" (alumno o coach). Después de
// traer filas de estas tablas, buscamos el nombre correspondiente y lo
// agregamos como "<columna sin _id>_nombre" — así el asistente no necesita
// gastar otra consulta (y otro tanto de tokens, que son escasos en el plan
// gratis) solo para mostrar el nombre en vez del id.
const PROFILE_FK_COLUMNS = {
  training_plans: ["coach_id"],
  training_plan_assignments: ["student_id", "coach_id"],
  workout_completions: ["student_id"],
  exercise_weight_logs: ["student_id"],
  // exercise_stages NO tiene coach_id — es un catálogo compartido entre
  // todos los coaches (name, color, display_order), no algo de un alumno.
  plan_folders: ["coach_id"],
  body_measurements: ["student_id"],
  workout_logs: ["student_id"],
  macrocycles: ["student_id"],
  // macrocycle_months, macrocycle_weeks y macrocycle_objectives no tienen
  // student_id ni coach_id directo (se llega al alumno a través de
  // macrocycles → macrocycle_months → macrocycle_weeks).
};

// Verbos en modo imperativo/infinitivo que casi siempre significan que
// piden CREAR, MODIFICAR o BORRAR un dato (no leerlo). Este asistente es
// 100% de solo lectura — ninguna herramienta que tiene puede escribir nada
// en la base — pero un modelo de IA a veces puede "alucinar" y decir que
// hizo un cambio aunque no exista forma de hacerlo. Por eso este chequeo
// corta ACÁ, antes de llamar al modelo, y responde siempre lo mismo: rápido,
// sin gastar tokens, y sin ninguna chance de que invente una confirmación.
const WRITE_INTENT_RE =
  /\b(cre(a|á)(le|me)?|agreg(a|á)(le|me)?|añad(e|í)(le|me)?|insert(a|á)|modific(a|á)(le|me)?|edit(a|á)(le|me)?|actualiz(a|á)(le|me)?|borr(a|á)(le|me|lo|la)?|elimin(a|á)(le|me|lo|la)?|quit(a|á)(le|me)?|remov(é|e)(le|me)?|sac(a|á)(le|me)?|desactiv(a|á)|reset(e|é)a?|restablec(e|é)|dar\s+de\s+baja)\w*/i;

function esPedidoDeEscritura(texto) {
  return WRITE_INTENT_RE.test(texto || "");
}

const RESPUESTA_OCUPADO =
  "El asistente está recibiendo muchas consultas en este momento (tiene un límite de uso gratuito). " +
  "Probá en unos minutos — la información no se pierde, solo hay que esperar el cupo.";

const RESPUESTA_SOLO_LECTURA =
  "**No puedo hacer eso.** Este asistente es solo de consulta: puede leer información de Stability, " +
  "pero no tiene ninguna forma de crear, modificar ni borrar datos. Para hacer ese cambio, andá a la " +
  "sección correspondiente del panel (alumnos, planes, entrenamientos, etc.).";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "consultar_tabla",
      description:
        "Lee filas de una tabla de la base de datos de Stability (SOLO LECTURA). Siempre trae todas " +
        "las columnas reales de la tabla, más 'student_nombre'/'coach_nombre' cuando corresponde " +
        "(agregados automáticamente, no son columnas de la base — no los uses en 'filtros' ni en " +
        "'orden', solo para leer el resultado). Para preguntas de tipo '¿cuántos...?' usá 'contar': " +
        "true — te devuelve el TOTAL exacto que cumple los filtros, sin el límite de 50 filas (nunca " +
        "digas que no podés contar el total, esta herramienta sí puede). " +
        "Usalo para responder preguntas sobre alumnos (tabla profiles), planes de entrenamiento " +
        "(training_plans, training_plan_days, training_plan_exercises), asignaciones de planes a " +
        "alumnos (training_plan_assignments), entrenamientos completados (workout_completions), " +
        "cargas registradas (exercise_weight_logs), medidas corporales (body_measurements: peso, grasa " +
        "corporal, masa muscular a lo largo del tiempo) y planificación a largo plazo por alumno " +
        "(macrocycles, macrocycle_months, macrocycle_weeks, macrocycle_objectives). Podés llamarla " +
        "varias veces encadenadas, por ejemplo primero buscar el id de un alumno por nombre y después " +
        "usar ese id para filtrar otra tabla.",
      parameters: {
        type: "object",
        properties: {
          tabla: {
            type: "string",
            enum: ALLOWED_TABLES,
            description: "Nombre de la tabla a consultar",
          },
          contar: {
            type: "boolean",
            description:
              "Si es true, en vez de traer filas devuelve solo la cantidad TOTAL que cumple los " +
              "filtros (ignora 'limite' y 'orden'). Usalo siempre para preguntas de conteo.",
          },
          filtros: {
            type: "array",
            description: "Condiciones para filtrar filas (se combinan todas con AND).",
            items: {
              type: "object",
              properties: {
                columna: { type: "string" },
                operador: { type: "string", enum: ALLOWED_OPERATORS },
                valor: {
                  description:
                    "Valor a comparar. Si el operador es 'in', tiene que ser una lista de valores, por ejemplo [\"id1\", \"id2\"].",
                },
              },
              required: ["columna", "operador", "valor"],
            },
          },
          orden: {
            type: "object",
            properties: {
              columna: { type: "string" },
              ascendente: { type: "boolean" },
            },
          },
          limite: {
            type: "integer",
            description: "Máximo de filas a devolver (default 10, máximo 50).",
          },
        },
        required: ["tabla"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buscar_plan_de_alumno",
      description:
        "Trae de una sola vez el plan de entrenamiento vigente (o el más reciente si no hay uno activo) de " +
        "un alumno, con todos sus días y ejercicios ya armados y ordenados. Usá SIEMPRE esta herramienta " +
        "cuando te pregunten por 'el plan de', 'la rutina de' o 'los ejercicios de' un alumno puntual — " +
        "NO trates de armarlo vos encadenando varios llamados a consultar_tabla (profiles, " +
        "training_plan_assignments, training_plans, training_plan_days, training_plan_exercises), porque " +
        "es lento y consume muchos tokens; esta herramienta ya hace todo eso internamente en un solo paso.",
      parameters: {
        type: "object",
        properties: {
          nombre_alumno: {
            type: "string",
            description: "Nombre y/o apellido del alumno, tal como lo escribió la persona que pregunta.",
          },
        },
        required: ["nombre_alumno"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alumnos_sin_entrenar",
      description:
        "Devuelve los alumnos activos que NO completaron NINGÚN entrenamiento en los últimos N días " +
        "(incluye también a los que nunca completaron ninguno). Usá SIEMPRE esta herramienta para preguntas " +
        "de tipo 'alumnos inactivos', 'que no entrenaron', 'en riesgo de abandonar' o 'sin actividad' en un " +
        "período — NO trates de calcularlo vos mismo comparando fechas de consultar_tabla. Si te dan el " +
        "período en semanas o meses, convertilo vos a días antes de llamar a esta herramienta (1 semana = " +
        "7 días, 1 mes ≈ 30 días).",
      parameters: {
        type: "object",
        properties: {
          dias: {
            type: "integer",
            description: "Cantidad de días sin entrenar para considerar inactivo a un alumno (default 90).",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "alumnos_sin_plan",
      description:
        "Compara TODOS los alumnos activos contra las asignaciones de plan con status activo, y devuelve " +
        "tanto el total que SÍ tiene plan asignado ('total_con_plan_asignado') como el total que NO tiene " +
        "('total_sin_plan_asignado', con la lista de nombres). Usá SIEMPRE esta herramienta para preguntas " +
        "de tipo '¿cuántos alumnos tienen plan asignado?' o '¿cuántos no tienen plan?' — NO uses " +
        "consultar_tabla para esto, porque con más de 50 alumnos activos el límite de filas te va a dar un " +
        "resultado incompleto y vas a terminar diciendo que no podés calcularlo (sí podés, con esta " +
        "herramienta).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "ranking_alumnos_por_entrenamientos",
      description:
        "Ranking de alumnos por cantidad de entrenamientos completados en los últimos N días (para 'quién " +
        "entrenó más', 'alumno más constante', etc.). Convertí semanas/meses a días antes de llamarla.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "integer", description: "Período en días hacia atrás (default 30)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adherencia_alumnos",
      description:
        "Calcula el PROMEDIO de entrenamientos completados por semana, por alumno, en los últimos N " +
        "días, y cuántos alumnos llegan a un mínimo dado. Usá SIEMPRE esta herramienta para preguntas " +
        "de tipo '¿cuántos alumnos entrenan en promedio más de X veces por semana?', 'adherencia de los " +
        "alumnos' o similares — consultar_tabla no puede calcular promedios, nunca digas que no podés " +
        "hacer este cálculo, esta herramienta sí puede.",
      parameters: {
        type: "object",
        properties: {
          dias: { type: "integer", description: "Período en días hacia atrás a considerar (default 30)." },
          minimo_por_semana: {
            type: "number",
            description: "Promedio semanal mínimo para contar a un alumno como que 'cumple' (default 2).",
          },
        },
      },
    },
  },
];

// Gemini pide las herramientas en otro formato ({ functionDeclarations: [...] }
// en vez de una lista de { type: "function", function: {...} }), pero el
// "parameters" de cada una (type/properties/enum/required) es compatible tal
// cual. Se arma UNA sola vez acá a partir de TOOLS, para no mantener las
// definiciones duplicadas.
const GEMINI_TOOLS = [{ functionDeclarations: TOOLS.map((t) => t.function) }];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini (nivel gratis) limita cuántos PEDIDOS se pueden hacer por minuto
// (no tanto los tokens, que tienen mucho más margen que en Groq). Si nos
// frenan por eso (429), esperamos el tiempo que indica el propio error y
// reintentamos, en vez de cortar la conversación.
async function callGeminiWithRetry(body, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response;
    try {
      response = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      // Cortes de red pasajeros (ECONNRESET, "fetch failed", etc.) — antes esto
      // tiraba abajo toda la conversación con un 500. Reintentamos en vez de
      // perder todo el trabajo ya hecho.
      if (attempt === maxRetries) throw networkErr;
      const waitMs = 1500 * (attempt + 1);
      console.log(
        `[ai-chat] Error de red con Gemini (${networkErr.message}), reintentando en ${waitMs}ms (intento ${attempt + 1}/${maxRetries})`
      );
      await sleep(waitMs);
      continue;
    }

    // Casos que vale la pena reintentar en vez de rendirse al toque:
    // - 429: cupo de pedidos por minuto agotado.
    // - 403 "PERMISSION_DENIED": parece ser un hueco pasajero del sistema
    //   anti-abuso de las API keys recién creadas — no significa
    //   necesariamente que la clave esté mal.
    // - 500/502/503/504: falla transitoria del lado de Google (por ejemplo
    //   "This model is currently experiencing high demand" con 503) — el
    //   propio mensaje de Google en ese caso dice que reintentar más tarde
    //   normalmente funciona.
    const reintentable = response.status === 429 || response.status === 403 || response.status >= 500;
    if (!reintentable || attempt === maxRetries) {
      return response;
    }

    // El mensaje de error de Google trae el tiempo de espera sugerido de dos
    // formas posibles según el caso ("retryDelay":"31s" o "Please retry in
    // 31.4s") — probamos ambas y, si ninguna aparece (como en un 403 o un
    // 503, que no traen tiempo sugerido), esperamos un poco más en cada
    // intento (backoff progresivo).
    const raw = await response.clone().text().catch(() => "");
    const matchRetryDelay = raw.match(/"retryDelay"\s*:\s*"([\d.]+)s"/i);
    const matchRetryIn = raw.match(/retry in ([\d.]+)s/i);
    const segundos = matchRetryDelay?.[1] || matchRetryIn?.[1];
    const waitMs = segundos ? Math.ceil(parseFloat(segundos) * 1000) + 250 : 2000 * (attempt + 1);

    console.log(
      `[ai-chat] Gemini devolvió ${response.status}, reintentando en ${waitMs}ms (intento ${attempt + 1}/${maxRetries})`
    );
    await sleep(waitMs);
  }
}

function buildSupabaseForUser(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const ARGENTINA_TZ = "America/Argentina/Buenos_Aires";
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

// La base guarda las fechas en UTC. Las convertimos a hora de Argentina ACÁ
// (antes de que el modelo las vea) porque pedirle a un modelo de IA que haga
// la resta de horas a mano no es confiable — mejor que reciba el dato ya listo.
function toArgentinaTime(isoString) {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ARGENTINA_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

// OJO: acá NO pisamos el valor original de cada campo de fecha — lo dejamos
// tal cual (UTC/ISO) y agregamos un campo hermano "<campo>_local" con la
// versión ya convertida a hora de Argentina. Antes se reemplazaba el valor
// original, y el modelo terminaba reusando ese texto ya formateado (por
// ejemplo "05/09/2026, 13:43") como si fuera un valor válido para un filtro
// de fecha en una consulta posterior — cosa que nunca funciona, porque la
// base sigue guardando el dato en UTC/ISO. Con los dos campos separados, el
// original queda disponible para filtrar/comparar, y el "_local" es el que
// se usa solo para mostrarle el dato a la persona.
function convertDatesToArgentina(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map((row) => {
    const conObj = { ...row };
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && ISO_DATETIME_RE.test(value)) {
        conObj[`${key}_local`] = toArgentinaTime(value);
      }
    }
    return conObj;
  });
}

// Busca el plan de entrenamiento completo de un alumno (por nombre) en un
// solo paso del servidor, en vez de que el modelo tenga que encadenar 4-5
// llamados (profiles -> assignments -> plan -> days -> exercises). Con el
// límite de 5 turnos y el cupo de tokens de Groq, esa cadena manual fallaba
// seguido ("No pude terminar de procesar esa consulta").
async function buscarPlanDeAlumno(supabase, nombreAlumno) {
  const nombre = (nombreAlumno || "").trim();
  if (!nombre) {
    return { error: "Falta el nombre del alumno." };
  }

  const tokens = nombre.split(/\s+/).filter(Boolean);
  const orFiltro = tokens
    .map((t) => `first_name.ilike.%${t}%,last_name.ilike.%${t}%`)
    .join(",");

  const { data: candidatos, error: candidatosError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("role", "student")
    .or(orFiltro);

  if (candidatosError) return { error: candidatosError.message };
  if (!candidatos || candidatos.length === 0) {
    return { error: `No encontré ningún alumno que coincida con "${nombre}".` };
  }

  const puntaje = (p) => {
    const completo = `${p.first_name} ${p.last_name}`.toLowerCase();
    return tokens.filter((t) => completo.includes(t.toLowerCase())).length;
  };
  const ordenados = [...candidatos].sort((a, b) => puntaje(b) - puntaje(a));
  const mejorPuntaje = puntaje(ordenados[0]);
  const empatados = ordenados.filter((p) => puntaje(p) === mejorPuntaje);

  if (empatados.length > 1) {
    return {
      aviso: `Hay más de un alumno que coincide con "${nombre}", pedile a la persona que aclare cuál.`,
      alumnos_posibles: empatados.map((p) => `${p.first_name} ${p.last_name}`),
    };
  }

  const alumno = ordenados[0];
  const nombreCompleto = `${alumno.first_name} ${alumno.last_name}`.trim();

  const { data: asignaciones, error: asignacionesError } = await supabase
    .from("training_plan_assignments")
    .select("id, plan_id, status, start_date, end_date, assigned_at")
    .eq("student_id", alumno.id)
    .order("assigned_at", { ascending: false });

  if (asignacionesError) return { error: asignacionesError.message };
  if (!asignaciones || asignaciones.length === 0) {
    return { alumno: nombreCompleto, aviso: "Este alumno no tiene ningún plan asignado." };
  }

  const asignacion =
    asignaciones.find((a) => a.status === "active") || asignaciones[0];

  const { data: plan, error: planError } = await supabase
    .from("training_plans")
    .select(
      "title, description, start_date, end_date, total_days, days_per_week, total_weeks, plan_type, difficulty_level"
    )
    .eq("id", asignacion.plan_id)
    .single();

  if (planError) return { error: planError.message };

  const { data: dias, error: diasError } = await supabase
    .from("training_plan_days")
    .select("id, day_number, day_name, display_order")
    .eq("plan_id", asignacion.plan_id)
    .order("display_order", { ascending: true });

  if (diasError) return { error: diasError.message };

  const diaIds = (dias || []).map((d) => d.id);
  let ejerciciosPorDia = new Map();
  if (diaIds.length > 0) {
    const { data: ejercicios, error: ejerciciosError } = await supabase
      .from("training_plan_exercises")
      .select("day_id, exercise_name, series, reps, pause, display_order")
      .in("day_id", diaIds)
      .order("display_order", { ascending: true })
      .limit(200);

    if (ejerciciosError) return { error: ejerciciosError.message };
    for (const ej of ejercicios || []) {
      if (!ejerciciosPorDia.has(ej.day_id)) ejerciciosPorDia.set(ej.day_id, []);
      ejerciciosPorDia.get(ej.day_id).push({
        ejercicio: ej.exercise_name,
        series: ej.series,
        reps: ej.reps,
        pausa: ej.pause,
      });
    }
  }

  const diasConEjercicios = (dias || []).map((d) => ({
    dia: d.day_number,
    nombre: d.day_name,
    ejercicios: ejerciciosPorDia.get(d.id) || [],
  }));

  return {
    alumno: nombreCompleto,
    plan: plan?.title,
    descripcion: plan?.description || undefined,
    estado_asignacion: asignacion.status,
    fecha_inicio: asignacion.start_date,
    fecha_fin: asignacion.end_date,
    dias_por_semana: plan?.days_per_week,
    semanas_totales: plan?.total_weeks,
    nivel: plan?.difficulty_level || undefined,
    dias: diasConEjercicios,
    otros_planes_del_alumno: asignaciones.length - 1,
  };
}

// Alumnos activos que no completaron ningún entrenamiento en los últimos N
// días (incluye a los que nunca completaron ninguno). Es una pregunta de
// negocio típica ("¿quién está en riesgo de abandonar?", "¿quién no entrena
// hace rato?") que necesita comparar, POR ALUMNO, la fecha de SU último
// entrenamiento contra un límite — algo que un modelo chico no arma bien
// encadenando filtros de consultar_tabla. Se resuelve acá en un solo paso.
async function buscarAlumnosInactivos(supabase, diasParam) {
  const dias = Math.min(Math.max(Number(diasParam) || 90, 1), 365);
  const limiteMs = Date.now() - dias * 24 * 60 * 60 * 1000;

  const { data: alumnos, error: alumnosError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_archived")
    .eq("role", "student");

  if (alumnosError) return { error: alumnosError.message };

  const alumnosActivos = (alumnos || []).filter((a) => !a.is_archived);
  if (alumnosActivos.length === 0) {
    return { aviso: "No hay alumnos activos registrados." };
  }

  // Traemos solo student_id + completed_at (liviano) y calculamos el último
  // entrenamiento de cada uno acá mismo, en vez de pedirle "MAX(fecha) por
  // alumno" a la herramienta genérica (PostgREST no arma esa agregación).
  const { data: completados, error: completadosError } = await supabase
    .from("workout_completions")
    .select("student_id, completed_at")
    .order("completed_at", { ascending: false })
    .limit(5000);

  if (completadosError) return { error: completadosError.message };

  const ultimoPorAlumno = new Map();
  for (const c of completados || []) {
    // Como ya viene ordenado del más nuevo al más viejo, la primera vez que
    // aparece cada student_id es justamente su entrenamiento más reciente.
    if (!ultimoPorAlumno.has(c.student_id)) {
      ultimoPorAlumno.set(c.student_id, c.completed_at);
    }
  }

  const inactivos = [];
  for (const alumno of alumnosActivos) {
    const nombre = `${alumno.first_name} ${alumno.last_name}`.trim();
    const ultimaFecha = ultimoPorAlumno.get(alumno.id);

    if (!ultimaFecha) {
      inactivos.push({ alumno: nombre, nunca_entreno: true });
      continue;
    }

    const ts = new Date(ultimaFecha).getTime();
    if (Number.isNaN(ts) || ts < limiteMs) {
      inactivos.push({
        alumno: nombre,
        ultimo_entrenamiento: toArgentinaTime(ultimaFecha),
        dias_sin_entrenar: Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)),
      });
    }
  }

  inactivos.sort((a, b) => (b.dias_sin_entrenar ?? Infinity) - (a.dias_sin_entrenar ?? Infinity));

  return {
    umbral_dias: dias,
    total_alumnos_activos: alumnosActivos.length,
    total_inactivos: inactivos.length,
    alumnos_inactivos: inactivos.slice(0, 50),
  };
}

// Cuántos alumnos activos TIENEN y cuántos NO TIENEN un plan asignado con
// status "active" ahora mismo. Es la misma comparación en los dos sentidos
// ("¿cuántos tienen plan?" y "¿cuántos alumnos no tienen plan?"), así que una
// sola herramienta responde ambas preguntas — antes solo devolvía el lado
// "sin plan", y para el otro lado el modelo trataba de traer los +50 alumnos
// activos con consultar_tabla y se quedaba corto por el límite de 50 filas.
async function buscarAlumnosSinPlan(supabase) {
  const { data: alumnos, error: alumnosError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_archived")
    .eq("role", "student");
  if (alumnosError) return { error: alumnosError.message };

  const activos = (alumnos || []).filter((a) => !a.is_archived);
  if (activos.length === 0) return { aviso: "No hay alumnos activos registrados." };

  const { data: asignacionesActivas, error: asignacionesError } = await supabase
    .from("training_plan_assignments")
    .select("student_id")
    .eq("status", "active");
  if (asignacionesError) return { error: asignacionesError.message };

  const idsActivos = new Set(activos.map((a) => a.id));
  const conPlan = new Set(
    (asignacionesActivas || []).map((a) => a.student_id).filter((id) => idsActivos.has(id))
  );
  const sinPlan = activos.filter((a) => !conPlan.has(a.id)).map((a) => `${a.first_name} ${a.last_name}`.trim());

  return {
    total_alumnos_activos: activos.length,
    total_con_plan_asignado: conPlan.size,
    total_sin_plan_asignado: sinPlan.length,
    alumnos_sin_plan_asignado: sinPlan,
  };
}

// Ranking de alumnos por cantidad de entrenamientos completados en los
// últimos N días — igual que con alumnos inactivos, es una agregación por
// alumno que PostgREST no arma en un solo SELECT, así que se cuenta acá.
async function rankingAlumnosPorEntrenamientos(supabase, diasParam) {
  const dias = Math.min(Math.max(Number(diasParam) || 30, 1), 365);
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data: completados, error } = await supabase
    .from("workout_completions")
    .select("student_id, completed_at")
    .gte("completed_at", desde)
    .limit(5000);
  if (error) return { error: error.message };

  const conteoPorAlumno = new Map();
  for (const c of completados || []) {
    conteoPorAlumno.set(c.student_id, (conteoPorAlumno.get(c.student_id) || 0) + 1);
  }
  if (conteoPorAlumno.size === 0) {
    return { periodo_dias: dias, aviso: "Nadie completó ningún entrenamiento en ese período." };
  }

  const { data: alumnos, error: alumnosError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", Array.from(conteoPorAlumno.keys()));
  if (alumnosError) return { error: alumnosError.message };

  const nombreById = new Map((alumnos || []).map((a) => [a.id, `${a.first_name} ${a.last_name}`.trim()]));

  const ranking = Array.from(conteoPorAlumno.entries())
    .map(([id, cantidad]) => ({
      alumno: nombreById.get(id) || "(sin nombre registrado)",
      entrenamientos_completados: cantidad,
    }))
    .sort((a, b) => b.entrenamientos_completados - a.entrenamientos_completados)
    .slice(0, 20);

  return { periodo_dias: dias, ranking };
}

// Adherencia: promedio de entrenamientos completados POR SEMANA, por alumno,
// en los últimos N días, y cuántos alumnos llegan a un mínimo dado. Es un
// promedio agrupado por alumno — otra agregación que PostgREST no arma en un
// SELECT directo — así que, igual que con el ranking y los inactivos, se
// calcula acá mismo en vez de esperar que el modelo la resuelva mentalmente.
async function calcularAdherenciaAlumnos(supabase, diasParam, minimoParam) {
  const dias = Math.min(Math.max(Number(diasParam) || 30, 7), 365);
  const minimoPorSemana = Number(minimoParam) || 2;
  const semanas = dias / 7;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  const { data: alumnos, error: alumnosError } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, is_archived")
    .eq("role", "student");
  if (alumnosError) return { error: alumnosError.message };

  const activos = (alumnos || []).filter((a) => !a.is_archived);
  if (activos.length === 0) return { aviso: "No hay alumnos activos registrados." };

  const { data: completados, error } = await supabase
    .from("workout_completions")
    .select("student_id, completed_at")
    .gte("completed_at", desde)
    .limit(5000);
  if (error) return { error: error.message };

  const conteoPorAlumno = new Map();
  for (const c of completados || []) {
    conteoPorAlumno.set(c.student_id, (conteoPorAlumno.get(c.student_id) || 0) + 1);
  }

  const detalle = activos.map((a) => {
    const nombre = `${a.first_name} ${a.last_name}`.trim();
    const cantidad = conteoPorAlumno.get(a.id) || 0;
    const promedioSemanal = Math.round((cantidad / semanas) * 10) / 10;
    return { alumno: nombre, promedio_semanal: promedioSemanal, total_entrenamientos: cantidad };
  });

  const cumplenElMinimo = detalle.filter((d) => d.promedio_semanal >= minimoPorSemana);
  const promedioGeneral =
    detalle.length > 0
      ? Math.round((detalle.reduce((sum, d) => sum + d.promedio_semanal, 0) / detalle.length) * 10) / 10
      : 0;

  return {
    periodo_dias: dias,
    minimo_por_semana: minimoPorSemana,
    total_alumnos_activos: activos.length,
    promedio_semanal_general: promedioGeneral,
    cantidad_que_cumple_el_minimo: cumplenElMinimo.length,
    alumnos_que_cumplen: cumplenElMinimo
      .sort((a, b) => b.promedio_semanal - a.promedio_semanal)
      .slice(0, 50)
      .map((d) => ({ alumno: d.alumno, promedio_semanal: d.promedio_semanal })),
  };
}

async function runTool(supabase, toolName, input) {
  if (toolName === "buscar_plan_de_alumno") {
    return await buscarPlanDeAlumno(supabase, input?.nombre_alumno);
  }

  if (toolName === "alumnos_sin_entrenar") {
    return await buscarAlumnosInactivos(supabase, input?.dias);
  }

  if (toolName === "alumnos_sin_plan") {
    return await buscarAlumnosSinPlan(supabase);
  }

  if (toolName === "ranking_alumnos_por_entrenamientos") {
    return await rankingAlumnosPorEntrenamientos(supabase, input?.dias);
  }

  if (toolName === "adherencia_alumnos") {
    return await calcularAdherenciaAlumnos(supabase, input?.dias, input?.minimo_por_semana);
  }

  if (toolName !== "consultar_tabla") {
    return { error: `Herramienta desconocida: ${toolName}` };
  }

  const { tabla, filtros, orden, limite, contar } = input || {};

  if (!ALLOWED_TABLES.includes(tabla)) {
    return { error: `Tabla no permitida: ${tabla}. Tablas disponibles: ${ALLOWED_TABLES.join(", ")}` };
  }

  // Si el modelo intenta filtrar u ordenar por un campo agregado (uno que
  // NO es una columna real de la base, como "student_nombre" o
  // "completed_at_local"), antes esto se ignoraba en silencio — la consulta
  // se ejecutaba igual pero sin ese filtro, y el modelo recibía datos que no
  // tenían nada que ver con lo que pidió, sin ningún aviso. Eso lo hacía dar
  // vueltas probando una consulta tras otra sin entender por qué. Ahora se
  // avisa con un error claro, al toque, para que corrija en el siguiente paso.
  const columnaInventada = [...(filtros || []), orden].find(
    (f) => f?.columna && (f.columna.endsWith("_nombre") || f.columna.endsWith("_local"))
  )?.columna;
  if (columnaInventada) {
    return {
      error:
        `"${columnaInventada}" no es una columna real de la base — es un dato agregado que se agrega ` +
        "DESPUÉS de la consulta, para mostrar. No se puede filtrar ni ordenar por él. Para buscar por " +
        "nombre de un alumno, primero buscá su id en la tabla 'profiles' filtrando por 'first_name' y/o " +
        "'last_name', y después usá ese id para filtrar la otra tabla (por 'student_id' o 'coach_id'). Si " +
        "la pregunta es sobre el plan de un alumno puntual, usá directamente la herramienta " +
        "'buscar_plan_de_alumno', que ya busca al alumno por nombre internamente.",
    };
  }

  // Modo "contar": pide el TOTAL exacto a Postgres (head: true = no trae
  // filas, solo el número) en vez de traer hasta 50 filas y contarlas acá,
  // que daría un número incompleto si hay más de 50 que cumplen el filtro.
  if (contar) {
    let countQuery = supabase.from(tabla).select("*", { count: "exact", head: true });
    for (const f of filtros || []) {
      if (!f || !ALLOWED_OPERATORS.includes(f.operador)) continue;
      countQuery = countQuery[f.operador](f.columna, f.valor);
    }
    const { count, error: countError } = await countQuery;
    if (countError) return { error: countError.message };
    return { cantidad_total: count ?? 0 };
  }

  // Siempre "*": los campos "*_nombre" (student_nombre, coach_nombre) no son
  // columnas reales de la base, se agregan después de consultar — pedirlos
  // acá haría fallar la consulta.
  let query = supabase.from(tabla).select("*");

  for (const f of filtros || []) {
    if (!f || !ALLOWED_OPERATORS.includes(f.operador)) continue;
    query = query[f.operador](f.columna, f.valor);
  }

  if (orden?.columna) {
    query = query.order(orden.columna, { ascending: orden.ascendente !== false });
  }

  // Límite bajo a propósito: aunque Gemini tiene mucho más margen de tokens
  // que Groq, traer cientos de filas sigue siendo lento e innecesario para
  // una respuesta que un coach tiene que poder leer de un vistazo.
  const safeLimit = Math.min(Number(limite) || 10, 50);
  query = query.limit(safeLimit);

  const { data, error } = await query;
  if (error) {
    return { error: error.message };
  }

  const withArgentinaTimes = convertDatesToArgentina(data);
  const enriched = await addProfileNames(supabase, tabla, withArgentinaTimes);
  return { filas: enriched, cantidad: enriched?.length ?? 0 };
}

// Reemplaza los "*_id" que apuntan a un alumno/coach por el nombre real,
// buscándolo en profiles en una sola consulta extra (no le cuesta tokens al
// modelo de IA, así que conviene resolverlo acá en vez de que lo pida él).
async function addProfileNames(supabase, tabla, rows) {
  const fkColumns = PROFILE_FK_COLUMNS[tabla];
  if (!fkColumns || !Array.isArray(rows) || rows.length === 0) {
    return rows;
  }

  const idsToLookup = new Set();
  for (const row of rows) {
    for (const col of fkColumns) {
      if (row && row[col]) idsToLookup.add(row[col]);
    }
  }
  if (idsToLookup.size === 0) return rows;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", Array.from(idsToLookup));

  const nameById = new Map(
    (profiles || []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()])
  );

  return rows.map((row) => {
    const extra = {};
    for (const col of fkColumns) {
      const id = row?.[col];
      if (!id) continue;
      const label = col.replace(/_id$/, "_nombre");
      const name = nameById.get(id);
      // Siempre dejamos algo legible en el campo "_nombre" — así el modelo
      // nunca tiene que recurrir a mostrar el id crudo cuando el nombre
      // falta o el perfil tiene el nombre vacío en la base de datos.
      extra[label] = name && name.length > 0 ? name : "(sin nombre registrado)";
    }
    return { ...row, ...extra };
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!GEMINI_API_KEY) {
    console.error("[ai-chat] Falta GEMINI_API_KEY");
    return res.status(503).json({ error: "El asistente de IA todavía no está configurado en el servidor." });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("[ai-chat] Faltan variables de Supabase");
    return res.status(503).json({ error: "Faltan credenciales de Supabase en el servidor." });
  }

  const authHeader = req.headers.authorization || "";
  const accessToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!accessToken) {
    return res.status(401).json({ error: "Falta autenticación" });
  }

  const supabase = buildSupabaseForUser(accessToken);

  // Verificación extra de identidad y rol, además de lo que ya filtra RLS.
  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return res.status(401).json({ error: "Sesión inválida, volvé a iniciar sesión." });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "coach") {
    return res.status(403).json({ error: "Este asistente solo está disponible para el panel de administrador." });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Falta 'messages' en el body" });
  }

  // Corte temprano: si el último mensaje pide crear/modificar/borrar algo,
  // respondemos al instante sin llamar al modelo (ver WRITE_INTENT_RE arriba).
  const ultimoMensajeUsuario = [...messages].reverse().find((m) => m?.role === "user");
  if (ultimoMensajeUsuario && esPedidoDeEscritura(ultimoMensajeUsuario.content)) {
    return res.status(200).json({ reply: RESPUESTA_SOLO_LECTURA });
  }

  const argDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: ARGENTINA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayArg = argDateStr.format(new Date());
  const yesterdayArg = argDateStr.format(
    new Date(new Date(`${todayArg}T12:00:00-03:00`).getTime() - 24 * 60 * 60 * 1000)
  );
  // Rango UTC de un día completo en Argentina (00:00 a 24:00 hora ARG),
  // listo para usar como filtro gte/lt sin que el modelo tenga que calcular
  // ninguna resta de horario.
  const rangoUtc = (fechaArg) => ({
    desde: new Date(`${fechaArg}T00:00:00-03:00`).toISOString(),
    hasta: new Date(`${fechaArg}T23:59:59.999-03:00`).toISOString(),
  });
  const rangoUtcEntre = (desdeFecha, hastaFecha) => ({
    desde: new Date(`${desdeFecha}T00:00:00-03:00`).toISOString(),
    hasta: new Date(`${hastaFecha}T23:59:59.999-03:00`).toISOString(),
  });
  const rangoHoy = rangoUtc(todayArg);
  const rangoAyer = rangoUtc(yesterdayArg);

  // "esta semana"/"semana pasada"/"este mes"/"mes pasado": mismo criterio que
  // hoy/ayer (precalcular en el servidor, nunca pedirle a un modelo chico que
  // haga esta aritmética), pero para rangos más largos.
  const pad2 = (n) => String(n).padStart(2, "0");
  const sumarDiasFechaArg = (fechaArg, delta) => {
    const base = new Date(`${fechaArg}T12:00:00-03:00`); // mediodía ART, sin ambigüedad de día
    base.setUTCDate(base.getUTCDate() + delta);
    return argDateStr.format(base);
  };
  const anchorHoy = new Date(`${todayArg}T12:00:00-03:00`);
  const diaIsoSemana = ((anchorHoy.getUTCDay() + 6) % 7) + 1; // 1=lunes ... 7=domingo
  const lunesEstaSemana = sumarDiasFechaArg(todayArg, -(diaIsoSemana - 1));
  const domingoEstaSemana = sumarDiasFechaArg(lunesEstaSemana, 6);
  const lunesSemanaPasada = sumarDiasFechaArg(lunesEstaSemana, -7);
  const domingoSemanaPasada = sumarDiasFechaArg(lunesEstaSemana, -1);
  const rangoEstaSemana = rangoUtcEntre(lunesEstaSemana, domingoEstaSemana);
  const rangoSemanaPasada = rangoUtcEntre(lunesSemanaPasada, domingoSemanaPasada);

  const [anioHoy, mesHoy] = todayArg.split("-").map(Number);
  const ultimoDiaDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate(); // mes 1-indexado
  const primerDiaEsteMes = `${anioHoy}-${pad2(mesHoy)}-01`;
  const ultimoDiaEsteMes = `${anioHoy}-${pad2(mesHoy)}-${pad2(ultimoDiaDelMes(anioHoy, mesHoy))}`;
  let anioMesPasado = anioHoy;
  let mesPasado = mesHoy - 1;
  if (mesPasado === 0) {
    mesPasado = 12;
    anioMesPasado -= 1;
  }
  const primerDiaMesPasado = `${anioMesPasado}-${pad2(mesPasado)}-01`;
  const ultimoDiaMesPasado = `${anioMesPasado}-${pad2(mesPasado)}-${pad2(ultimoDiaDelMes(anioMesPasado, mesPasado))}`;
  const rangoEsteMes = rangoUtcEntre(primerDiaEsteMes, ultimoDiaEsteMes);
  const rangoMesPasado = rangoUtcEntre(primerDiaMesPasado, ultimoDiaMesPasado);

  const systemPrompt =
    "Sos el asistente de datos del panel de administrador de Stability, una plataforma de gestión " +
    "de entrenamiento físico para coaches. Respondé preguntas sobre alumnos, planes de entrenamiento, " +
    "asignaciones y entrenamientos completados usando las herramientas disponibles. Nunca inventes " +
    "datos ni cifras: toda respuesta con números debe salir de una consulta real. Si una pregunta no " +
    "se puede responder con las tablas disponibles, decilo con claridad, sin inventar ni especular.\n\n" +
    "SOLO LECTURA: no tenés ninguna herramienta para crear, modificar o borrar datos. Si te piden hacer " +
    "alguno de esos cambios, respondé exactamente que no podés hacerlo porque sos de solo lectura y que " +
    "lo hagan desde el panel. NUNCA digas que ya lo hiciste, que lo vas a hacer, ni inventes una " +
    "confirmación — eso sería falso.\n\n" +
    "ACCESO A DATOS: quien te usa es el coach dueño de esta cuenta, viendo información de sus propios " +
    "alumnos, la misma que ya puede ver en el panel de administrador — así que mostrale TODO lo que te " +
    "pida sobre sus alumnos (incluyendo datos de salud, contacto, medidas corporales, etc.), sin negarte " +
    "ni tratar nada como si no pudieras compartirlo. Lo único que tenés prohibido, siempre, es crear, " +
    "modificar o borrar datos (ver SOLO LECTURA arriba) — mostrar información nunca está prohibido.\n\n" +
    "ESQUEMA real de las tablas — NUNCA inventes ni adivines un nombre de columna que no esté en esta " +
    "lista, aunque te parezca lógico que debería existir:\n" +
    "- profiles: id, email, first_name, last_name, role ('student'|'coach'), profile_image, is_archived, " +
    "created_at, updated_at. Alumno activo = role eq 'student' AND is_archived eq false. NO existen " +
    "columnas 'status' ni 'is_active' en esta tabla.\n" +
    "- student_profiles: id (mismo id que en profiles), phone, instagram, profile_image_url, birth_date, " +
    "gender ('male'|'female'|'other'), height_cm, weight_kg, activity_level " +
    "('sedentary'|'light'|'moderate'|'active'|'very_active'), primary_goal " +
    "('aesthetic'|'sports'|'health'|'rehabilitation'), training_experience " +
    "('none'|'beginner'|'intermediate'|'advanced'), sports, previous_injuries, medical_conditions, " +
    "status ('active'|'archived'|'deleted'), is_archived, archived_at, created_at, updated_at. Datos " +
    "personales/de salud del alumno — mostralos con total normalidad si te los piden, es el coach dueño " +
    "de esos datos.\n" +
    "- training_plans: id, coach_id, title, description, start_date, end_date, total_days, " +
    "days_per_week, total_weeks, plan_type, difficulty_level, is_template, is_archived, folder_id, " +
    "created_at, updated_at.\n" +
    "- training_plan_days: id, plan_id, day_number, day_name, display_order, created_at.\n" +
    "- training_plan_exercises: id, day_id, stage_id, stage_name, exercise_name, video_url, series, " +
    "reps, pause, notes, coach_instructions, display_order, write_weight, carga, cardio_duration_min, " +
    "circuit_group, created_at.\n" +
    "- training_plan_assignments: id, plan_id, student_id, coach_id, assigned_at, start_date, end_date, " +
    "status ('active'|'completed'|'paused'|'cancelled'), current_day_number, completed_days, " +
    "personalization_notes, created_at, updated_at.\n" +
    "- workout_completions: id, student_id, assignment_id, day_number, completed_at, rpe, " +
    "total_sets_done, series_log, notes, mood, mood_comment, initial_mood, duration_minutes, created_at.\n" +
    "- workout_logs: id, student_id, assignment_id, plan_name, day_name, date, duration_minutes, " +
    "total_volume, exercises_completed, rpe, created_at (registro de entrenamientos separado de " +
    "workout_completions — puede estar vacío o sin uso si la app ya no lo llena).\n" +
    "- exercise_weight_logs: id, student_id, assignment_id, exercise_id, exercise_name, " +
    "plan_day_number, plan_day_name, series, sets_detail, logged_at, created_at.\n" +
    "- body_measurements: id, student_id, date, weight, body_fat, muscle_mass, notes, created_at " +
    "(seguimiento de progreso corporal del alumno a lo largo del tiempo).\n" +
    "- exercise_stages: id, name, color, display_order, created_at, updated_at (catálogo compartido " +
    "entre todos los coaches, no tiene coach_id ni pertenece a un alumno).\n" +
    "- plan_folders: id, coach_id, name, parent_id, created_at, updated_at.\n" +
    "- macrocycles: id, student_id, start_date, created_at, updated_at (planificación a largo plazo de " +
    "un alumno).\n" +
    "- macrocycle_months: id, macrocycle_id, month_index (0 a 5), objective_id, created_at, updated_at.\n" +
    "- macrocycle_weeks: id, month_id, week_number (1 a 4), notes, created_at, updated_at.\n" +
    "- macrocycle_objectives: id, name, color, display_order, created_at, updated_at (catálogo " +
    "compartido de objetivos posibles, no pertenece a un alumno en particular).\n" +
    "Además de esas columnas reales, algunas filas ya vienen con campos agregados por el servidor que " +
    "NO son columnas de la base: 'student_nombre'/'coach_nombre' (nombre en vez de id) y '<campo>_local' " +
    "(fecha en hora Argentina) — usalos para leer el resultado, pero nunca en 'filtros' ni 'orden'.\n\n" +
    "REGLA ESTRICTA sobre ids: las filas que te devuelve la herramienta incluyen campos como id, " +
    "student_id, coach_id, plan_id, assignment_id, day_id, exercise_id, etc. Son códigos internos " +
    "sin ningún significado para la persona que te lee. NUNCA los muestres, ni siquiera como referencia, " +
    "aclaración, código entre paréntesis o corchetes, ni como 'ID: ...'. Si necesitás nombrar algo que " +
    "no tiene nombre propio (por ejemplo un entrenamiento), describilo por sus datos (alumno, fecha, día " +
    "del plan) en vez de por su id. Cuando corresponde, las filas ya incluyen un campo 'student_nombre' " +
    "y/o 'coach_nombre' con el nombre real (o '(sin nombre registrado)' si falta) — usalo siempre en vez " +
    "del id, no hace falta que lo busques por separado.\n\n" +
    "REGLA ESTRICTA sobre fechas: cada campo de fecha/hora (completed_at, created_at, assigned_at, " +
    "start_date, end_date, etc.) viene DOS veces: el campo original (en UTC, formato ISO como " +
    "'2026-09-05T16:43:00+00:00') y un campo hermano con sufijo '_local' (por ejemplo " +
    "'completed_at_local') ya convertido a la hora de Argentina y listo para mostrar. Para MOSTRARLE " +
    "la fecha a la persona, usá SIEMPRE el campo '_local', nunca el original — y nunca le agregues " +
    "'UTC' ni digas que está en UTC, ni hagas ninguna conversión de horario vos mismo. Para FILTRAR u " +
    "ordenar por fecha en 'filtros'/'orden' de consultar_tabla, usá SIEMPRE el campo original (sin " +
    "'_local'), copiando el valor UTC/ISO tal cual si lo sacaste de un resultado anterior — el campo " +
    "'_local' no existe en la base y un filtro sobre él va a fallar.\n\n" +
    "EFICIENCIA: pensá los filtros, el orden y el límite ANTES de llamar a una herramienta, para no " +
    "tener que repetir la misma consulta varias veces. Evitá especialmente reintentar la misma tabla " +
    "cambiando solo el 'limite' — normalmente alcanza con un límite razonable (10-30) y el filtro/orden " +
    "correcto en un solo llamado. Para IDENTIFICAR a un alumno por nombre, NUNCA encadenes varios " +
    "intentos con consultar_tabla probando distintas combinaciones de first_name/last_name — buscá una " +
    "sola vez con 'ilike' y un patrón amplio (por ejemplo last_name ilike '%apellido%'), y si necesitás " +
    "además su plan de entrenamiento, llamá directamente a buscar_plan_de_alumno (que ya busca por " +
    "nombre) en vez de armar vos la cadena profiles → training_plan_assignments → training_plan_days → " +
    "training_plan_exercises a mano.\n\n" +
    "NUNCA digas que no podés responder algo porque hay 'más de 50 filas' o porque el resultado se " +
    "'truncó': consultar_tabla con 'contar': true te da el TOTAL exacto sin ese límite, y para preguntas " +
    "sobre alumnos activos, inactivos, sin plan, ranking o promedio semanal ya existe una herramienta " +
    "dedicada (alumnos_sin_entrenar, alumnos_sin_plan, ranking_alumnos_por_entrenamientos, " +
    "adherencia_alumnos) que calcula bien el total sin traer todas las filas. Antes de decir que algo no " +
    "se puede calcular, revisá si alguna de esas herramientas ya resuelve la pregunta.\n\n" +
    "RANGOS DE FECHA ya calculados en hora de Argentina (no los recalcules vos, usalos tal cual): para " +
    "columnas de fecha+hora (completed_at, created_at, assigned_at) usá el rango 'UTC' con 'gte' (desde) y " +
    "'lt' (hasta) en un filtro de consultar_tabla; para columnas de solo fecha (start_date, end_date) usá el " +
    "rango 'fecha' con 'gte' (desde) y 'lte' (hasta). Un solo llamado con el rango correcto alcanza — no " +
    "repitas la consulta probando distintos 'limite'.\n" +
    `- hoy: fecha ${todayArg} | UTC ${rangoHoy.desde} a ${rangoHoy.hasta}\n` +
    `- ayer: fecha ${yesterdayArg} | UTC ${rangoAyer.desde} a ${rangoAyer.hasta}\n` +
    `- esta semana (lun-dom): fecha ${lunesEstaSemana} a ${domingoEstaSemana} | UTC ${rangoEstaSemana.desde} a ${rangoEstaSemana.hasta}\n` +
    `- semana pasada: fecha ${lunesSemanaPasada} a ${domingoSemanaPasada} | UTC ${rangoSemanaPasada.desde} a ${rangoSemanaPasada.hasta}\n` +
    `- este mes: fecha ${primerDiaEsteMes} a ${ultimoDiaEsteMes} | UTC ${rangoEsteMes.desde} a ${rangoEsteMes.hasta}\n` +
    `- mes pasado: fecha ${primerDiaMesPasado} a ${ultimoDiaMesPasado} | UTC ${rangoMesPasado.desde} a ${rangoMesPasado.hasta}\n\n` +
    "FORMATO de la respuesta (se muestra en un chat simple, sin formato markdown elaborado):\n" +
    "- Si son 4 filas o más con las mismas columnas, armá una tabla markdown simple: encabezado, fila " +
    "de guiones (|---|---|) y filas de datos, con columnas cortas y claras (nombre, fecha, estado, etc). " +
    "No incluyas ninguna columna de id.\n" +
    "- Si son pocos datos (1 a 3), escribilo como una lista corta con guiones ('- ') o una oración, sin tabla.\n" +
    "- No uses encabezados (#), ni tablas anidadas, ni texto de más. Podés usar **negrita** para resaltar " +
    "un dato puntual (un nombre, un número), con moderación.\n" +
    "Respondé siempre en español, de forma breve, clara y sin jerga técnica, como si le hablaras a " +
    "alguien sin conocimientos de programación ni de bases de datos.";

  const MAX_HISTORY_MESSAGES = 6;
  const recentMessages = messages.slice(-MAX_HISTORY_MESSAGES);
  // Gemini separa el system prompt del historial (va en "systemInstruction",
  // no como un mensaje más) y llama "model" al rol que en OpenAI/Groq era
  // "assistant" — el rol "user" es igual en los dos formatos.
  const contents = recentMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content || "" }],
  }));

  // Si el resultado de una herramienta trae un array largo (filas, alumnos,
  // ranking, etc.), lo recortamos ACÁ sacando elementos del array hasta que
  // entre en el máximo de caracteres — nunca cortando el texto a la mitad,
  // porque en el formato de Gemini el resultado va como objeto JSON real
  // (no como un string), y cortarlo a la mitad lo rompería.
  const MAX_TOOL_RESULT_CHARS = 6000;
  function limitarTamanoResultado(result, maxChars = MAX_TOOL_RESULT_CHARS) {
    if (JSON.stringify(result).length <= maxChars) return result;
    const recortado = { ...result };
    const clavesDeArray = Object.keys(recortado).filter((k) => Array.isArray(recortado[k]));
    for (const key of clavesDeArray) {
      while (JSON.stringify(recortado).length > maxChars && recortado[key].length > 1) {
        recortado[key] = recortado[key].slice(0, Math.ceil(recortado[key].length / 2));
      }
      recortado[`${key}_recortado`] = true;
    }
    return recortado;
  }

  // Igual idea que con Groq: si una pregunta encadena varios llamados a
  // herramientas, cada resultado se suma a la conversación. Gemini da mucho
  // más margen de tokens que Groq, pero igual dejamos completos solo los
  // últimos 2 resultados por las dudas (respuestas más rápidas y sin
  // desperdiciar cupo de pedidos por minuto, que en Gemini es más bajo).
  function podarResultadosViejos(mantenerUltimos = 2) {
    const indicesRespuesta = [];
    contents.forEach((c, i) => {
      if (c.parts?.some((p) => p.functionResponse)) indicesRespuesta.push(i);
    });
    const aPodar = indicesRespuesta.slice(0, Math.max(0, indicesRespuesta.length - mantenerUltimos));
    for (const i of aPodar) {
      contents[i] = {
        ...contents[i],
        parts: contents[i].parts.map((p) =>
          p.functionResponse
            ? {
                functionResponse: {
                  name: p.functionResponse.name,
                  response: { nota: "resultado anterior ya usado, omitido para ahorrar espacio" },
                },
              }
            : p
        ),
      };
    }
  }

  try {
    let finalText = "";

    for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
      podarResultadosViejos();
      const response = await callGeminiWithRetry({
        contents,
        tools: GEMINI_TOOLS,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 800 },
      });

      const data = await response.json();

      if (!response.ok) {
        // Antes esto le mostraba a la persona un error técnico en rojo. Ahora,
        // ante cualquier falla del lado de Gemini, respondemos como un
        // mensaje normal del asistente pidiendo paciencia — no es un error de
        // la app, es el límite de uso gratuito del modelo de IA.
        console.error("[ai-chat] Gemini error:", JSON.stringify(data));
        return res.status(200).json({ reply: RESPUESTA_OCUPADO });
      }

      const candidato = data.candidates?.[0];
      const parts = candidato?.content?.parts;
      if (!parts) {
        // Puede pasar si Gemini bloqueó la respuesta (filtros de seguridad) o
        // si vino en un formato inesperado — en ambos casos, mensaje normal
        // en vez de un error técnico.
        console.error("[ai-chat] Respuesta inesperada de Gemini:", JSON.stringify(data));
        return res.status(200).json({ reply: RESPUESTA_OCUPADO });
      }

      const functionCalls = parts.filter((p) => p.functionCall).map((p) => p.functionCall);

      if (functionCalls.length === 0) {
        finalText = parts
          .map((p) => p.text || "")
          .join("")
          .trim();
        break;
      }

      // Guardamos el turno del modelo (con sus function calls) tal cual, y
      // el resultado de cada una como el turno siguiente — Gemini necesita
      // ver los dos para seguir la conversación en el próximo pedido.
      contents.push({ role: "model", parts });

      const resultParts = [];
      for (const fc of functionCalls) {
        const args = fc.args || {};
        console.log("[ai-chat] tool_call:", fc.name, JSON.stringify(args));
        const resultado = await runTool(supabase, fc.name, args);
        resultParts.push({
          functionResponse: {
            name: fc.name,
            response: limitarTamanoResultado(resultado),
          },
        });
      }
      contents.push({ role: "user", parts: resultParts });
    }

    if (!finalText) {
      finalText = "No pude terminar de procesar esa consulta. Probá reformular la pregunta de forma más simple.";
    }

    return res.status(200).json({ reply: finalText });
  } catch (err) {
    console.error("[ai-chat] Exception:", err);
    return res.status(200).json({ reply: RESPUESTA_OCUPADO });
  }
}
