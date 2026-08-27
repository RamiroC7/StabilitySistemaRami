# Guía de Diseño y Estándares de Accesibilidad — Stability

Documento de referencia para el sistema de diseño, tokens visuales, accesibilidad e interacción en la plataforma Stability.

---

## §1. Principios Generales de Diseño

- **Mobile-first para Alumnos:** Interfaces táctiles, botones de al menos 44×44px, gestos naturales y soporte offline con Service Worker.
- **Desktop-first para Entrenadores:** Densidad de información equilibrada, navegación por teclado ágil y diálogos modales accesibles.
- **Estética Pulida:** Colores definidos con intencionalidad, soporte completo para tema claro y oscuro, y tipografía moderna con **Lexend** e **Inter**.

---

## §2. Sistema de Color y Ratios de Contraste (WCAG 2.1)

Todos los pares de color han sido auditados matemáticamente para cumplir o superar el estándar **WCAG 2.1 Nivel AA** (mínimo ratio 4.5:1 para texto normal y 3:1 para texto grande/componentes de interfaz).

### 2.1 Tokens Principales

| Token | Hex / Valor | Uso |
| :--- | :--- | :--- |
| `primary` | `#0056b3` | Botones principales, enlaces activos, badges de acento |
| `primary-hover` | `#004494` | Estados hover de botones primarios |
| `background-light` | `#f8f9fa` | Fondo general de páginas en tema claro |
| `background-dark` | `#0f1923` | Fondo general de páginas en tema oscuro |
| `surface-light` | `#F3F4F6` | Contenedores secundarios y pills en tema claro |
| `surface-dark` | `#1e293b` | Tarjetas y contenedores en tema oscuro |
| `text-main` | `#101418` | Títulos y texto de alto énfasis (Light) |
| `text-secondary` | `#475569` | Subtítulos, labels y metadatos (Light) |
| `text-muted` | `#475569` | Textos secundarios y leyendas (Light) |
| `text-dark` | `#f8fafc` | Texto principal en tema oscuro |
| `muted-dark` | `#94a3b8` | Textos secundarios en tema oscuro |
| `success` | `#10b981` | Estados completados y confirmaciones |
| `border-color` | `#dae0e7` | Bordes en tema claro |
| `border-dark` | `#475569` | Bordes en tema oscuro |

### 2.2 Auditoría de Contraste Medida

| Texto / Elemento | Fondo | Ratio Medido | Nivel WCAG |
| :--- | :--- | :---: | :---: |
| `primary` (`#0056b3`) | Blanco (`#FFFFFF`) | **7.04 : 1** | **AAA** |
| `text-main` (`#101418`) | Blanco (`#FFFFFF`) | **18.50 : 1** | **AAA** |
| `text-secondary` (`#475569`) | Blanco (`#FFFFFF`) | **7.58 : 1** | **AAA** |
| `text-secondary` (`#475569`) | `surface-light` (`#F3F4F6`) | **6.89 : 1** | **AA (Casi AAA)** |
| `text-secondary` (`#475569`) | `background-light` (`#f8f9fa`) | **7.19 : 1** | **AAA** |
| `text-dark` (`#f8fafc`) | `background-dark` (`#0f1923`) | **16.96 : 1** | **AAA** |
| `muted-dark` (`#94a3b8`) | `background-dark` (`#0f1923`) | **6.92 : 1** | **AA (Casi AAA)** |
| `muted-dark` (`#94a3b8`) | `card-dark` (`#1E293B`) | **5.71 : 1** | **AA** |

---

## §8. Accesibilidad e Interacción (A11y Standards)

### 8.1 Diálogos y Modales Accesibles
Todo diálogo o ventana emergente debe implementar el hook `useModalFocusTrap` o el componente base `<Modal>` (`src/components/ui/Modal.tsx`):
1. **Atrapamiento de Foco (Focus Trap):** Al abrirse un modal, la navegación con `Tab` y `Shift+Tab` permanece estrictamente confinada dentro del diálogo activo.
2. **Cierre por Teclado:** Presionar `Escape` cierra el diálogo (salvo durante procesos de guardado bloqueantes).
3. **Foco Inicial y Retorno:** El foco se sitúa de forma automática en el primer control interactivo al abrir, y se devuelve al elemento disparador (`trigger`) al cerrarse.
4. **Semántica ARIA:** Contenedor con `role="dialog"`, `aria-modal="true"`, `aria-labelledby="[id-del-titulo]"` y botones con `aria-label` descriptivos.
5. **Bloqueo de Fondo:** El scroll del `body` se desactiva mientras el modal esté visible.

### 8.2 Skip Links (Atajos de Teclado)
Los layouts principales (`MainLayout.tsx` para entrenadores y `TrainingLayout.tsx` para alumnos) incluyen un enlace de salto visible únicamente bajo foco:
```html
<a href="#main-content" class="sr-only focus:not-sr-only ...">
  Saltar al contenido principal
</a>
```
Permite a usuarios de lectores de pantalla y navegación por teclado saltar menús y barras laterales directamente a la vista activa.

### 8.3 Preferencias de Movimiento Reducido (`prefers-reduced-motion`)
La aplicación incluye soporte global en `src/index.css` para usuarios con sensibilidad vestibular:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```
Desactiva transiciones bruscas, giros continuos y escalados de zoom cuando el sistema operativo solicita movimiento reducido.
