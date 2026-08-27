# Stability

Plataforma integral de gestión de entrenamiento físico y seguimiento de alumnos para entrenadores y coaches, complementada con una Progressive Web App (PWA) mobile-first para los alumnos.

---

## 🚀 Características Principales

### 🏋️‍♂️ Panel de Entrenadores (Coach Platform)
- **Gestión de Alumnos:** Lista de alumnos activos, perfiles individuales, historial clínico/deportivo y estado de suscripciones.
- **Planificador de Rutinas:** Creación de planes de entrenamiento avanzados con soporte para ejercicios individuales, bloques y circuitos estructurados.
- **Biblioteca de Ejercicios:** Base de datos categorizada con videos demostrativos, instrucciones técnicas y grupos musculares.
- **Control de Vencimientos:** Monitoreo y alertas automáticas sobre asignaciones de planes próximos a vencer o vencidos.
- **Métricas y Estadísticas:** Panel de analíticas de rendimiento del negocio y adherencia de los alumnos.

### 📱 Experiencia de Alumnos (Training PWA)
- **Ejecución de Entrenamientos:** Flujo interactivo paso a paso para el registro de series, repeticiones, cargas y escala de esfuerzo percibido (RPE).
- **Temporizador de Descanso:** Timer de recuperación visual y sonoro integrado entre series.
- **Check-in de Estado de Ánimo:** Registro del estado previo a entrenar para contextualizar la sesión.
- **Seguimiento y Progreso:** Gráficos de evolución, récords personales y consistencia.
- **Soporte Offline & PWA:** Instalable en iOS y Android con persistencia y sincronización en cola de entrenamientos completados sin conexión.

---

## 🛠️ Stack Tecnológico

- **Frontend:** [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Estilos & UI:** [Tailwind CSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [Sonner](https://sonner.emilkowal.ski/)
- **Backend & Auth:** [Supabase](https://supabase.com/) (Auth, PostgreSQL Database, Storage)
- **Estado Global:** [Zustand](https://zustand-demo.pmnd.rs/)
- **Enrutamiento:** [React Router DOM v7](https://reactrouter.com/)
- **Testing:** [Vitest](https://vitest.dev/)
- **Analíticas:** [@vercel/analytics](https://vercel.com/analytics) & [@vercel/speed-insights](https://vercel.com/docs/speed-insights)

---

## 📦 Instalación y Configuración

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd professors-platform
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto tomando como base `.env.example`:

```env
VITE_SUPABASE_URL=tu_supabase_url
VITE_SUPABASE_ANON_KEY=tu_supabase_anon_key
VITE_STORAGE_BUCKET_EXERCISES=exercise-videos
```

---

## 💻 Scripts Disponibles

| Comando | Descripción |
| :--- | :--- |
| `npm run dev` | Inicia el servidor de desarrollo local con recarga rápida (HMR). |
| `npm run build` | Compila TypeScript y genera el bundle optimizado para producción. |
| `npm run preview` | Previsualiza localmente el build de producción. |
| `npm run test` | Ejecuta las pruebas unitarias con Vitest. |
| `npm run lint` | Analiza el código en busca de problemas de estilo y calidad con ESLint. |

---

## 📁 Estructura del Proyecto

```
professors-platform/
├── public/                 # Assets estáticos, íconos y splash screens PWA
├── src/
│   ├── components/         # Componentes transversales y de layout (Sidebar, BottomNav, etc.)
│   ├── features/           # Módulos por dominio
│   │   ├── auth/           # Login, registro, recuperación y autenticación
│   │   ├── library/        # Biblioteca de ejercicios del profesor
│   │   ├── metrics/        # Dashboard de estadísticas del coach
│   │   ├── plans/          # Creación y edición de planes de entrenamiento
│   │   ├── students/       # Gestión y perfiles de alumnos
│   │   └── training/       # Flujo completo de entrenamiento del alumno (PWA)
│   ├── hooks/              # Custom hooks reutilizables
│   ├── lib/                # Clientes y utilidades (Supabase, helpers, progreso, etc.)
│   ├── router/             # Definición de rutas protegidas por rol
│   ├── store/              # Stores globales con Zustand
│   ├── types/              # Definiciones TypeScript compartidas
│   ├── App.tsx             # Componente raíz y prefetch de rutas
│   └── main.tsx            # Punto de entrada de la aplicación
├── docs/                   # Documentación técnica y especificaciones de diseño
├── PWA-GUIA-IMPLEMENTACION.md # Guía detallada de soporte PWA e iOS Splash Screens
├── tailwind.config.cjs     # Configuración de estilos y tema visual
└── vite.config.ts          # Configuración de Vite y plugins (PWA, optimizador de imágenes)
```

---

## 📚 Documentación Adicional

- [Guía de Implementación PWA](./PWA-GUIA-IMPLEMENTACION.md): Documentación sobre Service Workers, caché offline y splash screens para iOS.
- [Diseño de Circuitos y Bloques](./docs/plans/2026-06-13-circuitos-design.md): Especificación técnica del modelo de bloques y circuitos.
