# Diseño de Circuitos (Superseries / Triseries) en Planificación y Entrenamiento

Este documento detalla el diseño técnico y visual para la implementación de circuitos (ejercicios realizados en ronda) dentro de la plataforma. La solución cubre tanto la creación y edición por parte del coach como la visualización y registro del entrenamiento por parte del alumno.

## 1. Arquitectura de Datos y Base de Datos

Para modelar la agrupación de ejercicios sin alterar la compatibilidad ni crear tablas relacionales complejas, utilizaremos un atributo de agrupación simple en el ejercicio del plan.

### 1.1 Cambios en Base de Datos (Supabase)
Se añadirá una columna a la tabla `training_plan_exercises`:
```sql
ALTER TABLE public.training_plan_exercises 
ADD COLUMN circuit_group text DEFAULT NULL;
```
* **Significado:** Si `circuit_group` tiene un valor como `'A'`, `'B'`, etc., el ejercicio forma parte de dicho circuito. Si es `NULL` (o una cadena vacía en JS), el ejercicio es individual.
* **RLS & Cascade:** Las políticas existentes de RLS e inserción en cascada siguen funcionando sin cambios.

### 1.2 Cambios en Interfaces TypeScript

#### [lib/types.ts](file:///c:/Users/Maximo/Documents/Stability/professors-platform/src/lib/types.ts)
```typescript
export interface PlanExercise {
  // ... campos existentes
  circuit_group?: string | null;
}
```

#### [features/training/types.ts](file:///c:/Users/Maximo/Documents/Stability/professors-platform/src/features/training/types.ts)
```typescript
export interface Exercise {
  // ... campos existentes
  circuit_group?: string | null;
}
```

---

## 2. Interfaz de Planificación (Coaches)

La tabla actual de ejercicios en [NewPlan.tsx](file:///c:/Users/Maximo/Documents/Stability/professors-platform/src/features/plans/NewPlan.tsx) se adaptará para agrupar visualmente los ejercicios.

### 2.1 Agrupación de Ejercicios
Se implementará una función auxiliar en el cliente para estructurar el listado plano de ejercicios antes de renderizarlo:
* Los ejercicios consecutivos con el mismo `circuit_group` se agruparán en un objeto de tipo `CircuitBlock`.
* Los ejercicios individuales se representarán como `IndividualBlock`.

### 2.2 Tarjeta de Circuito (`CircuitCard`)
Los bloques del tipo `CircuitBlock` se renderizarán dentro de un contenedor visual premium:
* **Diseño:** Fondo sutilmente sombreado con bordes redondeados y un borde lateral con color distintivo (por ejemplo, azul o violeta HSL).
* **Control de Series:** El control de cantidad de series se moverá al encabezado de la tarjeta del circuito como **un único campo de entrada para todo el grupo**. Modificar este campo actualizará automáticamente el campo `series` de todos los ejercicios dentro de ese circuito.
* **Reordenamiento Interno:** Se añadirán controles simples (flechas arriba/abajo) dentro del contenedor para cambiar el orden de los ejercicios *dentro* del circuito.
* **Drag-and-Drop Global:** La tarjeta del circuito completa actuará como un elemento sortable de `@dnd-kit/sortable`, permitiendo mover todo el circuito arriba o abajo en la rutina.
* **Línea de Pausa Conectora:** En la columna "Pausa", se dibujará una línea vertical punteada que unirá los campos de pausa de los ejercicios del circuito. La pausa del primer ejercicio representará el descanso de transición (con etiqueta `↓ Pausa al siguiente`), y la pausa del último ejercicio representará el descanso de fin de ronda (con etiqueta `↺ Fin de ronda`).

---

## 3. Interfaz de Ejecución de Entrenamiento (Alumnos)

### 3.1 Lista de Ejercicios del Día ([ExerciseList.tsx](file:///c:/Users/Maximo/Documents/Stability/professors-platform/src/features/training/ExerciseList.tsx))
* Los ejercicios agrupados en un circuito se renderizarán dentro de una sola tarjeta unificada.
* La tarjeta mostrará: **"Circuito A"**, la cantidad de series (vueltas) y una sublista con los nombres de los ejercicios que lo componen (`A1`, `A2`...).

### 3.2 Detalle del Entrenamiento ([ExerciseDetail.tsx](file:///c:/Users/Maximo/Documents/Stability/professors-platform/src/features/training/ExerciseDetail.tsx))
Cuando el índice de ejercicio activo corresponda a un circuito:
* Se cargará una vista unificada que ocupará toda la pantalla de detalle.
* La pantalla mostrará el progreso global del circuito (ej. **"Ronda 1 de 3"**).
* Se mostrará la lista de ejercicios del circuito de manera vertical. El ejercicio activo en el que el alumno debe registrar la serie estará resaltado.
* **Flujo de Ejecución (Paso a Paso):**
  1. El alumno completa la serie de `A1`, carga sus datos y toca "Check" para confirmar.
  2. Corre un temporizador de descanso corto correspondiente a la pausa de `A1`.
  3. Al terminar, la interfaz resalta y enfoca automáticamente `A2` para que el alumno haga la serie.
  4. El alumno completa la serie de `A2` y confirma.
  5. Al ser el último ejercicio, se activa el temporizador de descanso largo correspondiente a la pausa de `A2`.
  6. Finalizado el temporizador largo, el sistema incrementa la ronda activa a **"Ronda 2 de 3"** y el foco regresa a `A1` para realizar el siguiente set.
  7. Este ciclo se repite hasta completar todas las series/rondas del circuito. Al finalizar, el botón de navegación principal cambiará a "Siguiente Ejercicio" para avanzar al siguiente bloque de la rutina.

### 3.3 Guardado de Registros
* Los registros de peso y repeticiones se seguirán guardando en `seriesLog` usando la clave tradicional `${exerciseId}-${setIndex}`.
* Esto garantiza compatibilidad absoluta con la tabla `workout_completions` y los históricos de peso del alumno sin modificar el backend de persistencia.

---

## 4. Plan de Verificación

* **Base de Datos:** Verificar que la columna se cree correctamente y acepte valores nulos o texto.
* **Planificador (Coaches):**
  * Crear un circuito con 2 ejercicios.
  * Cambiar las series en el circuito y verificar que ambos ejercicios actualicen sus series en la DB.
  * Cambiar un ejercicio de `Circuito A` a `Individual` y verificar que salga del contenedor.
  * Reordenar el circuito por drag-and-drop completo y guardar.
* **Entrenamiento (Alumnos):**
  * Verificar que la lista del día agrupe correctamente los ejercicios.
  * Iniciar la rutina y verificar el comportamiento alternado de series y los dos tipos de cronómetros (corto y largo).
  * Confirmar que al guardar la rutina se inserten correctamente las repeticiones y cargas en Supabase.
