# Selvia ISP Calculator V0

**Ideal Study Path (ISP) Calculator** para las oposiciones de maestro en España.

Calcula tu plan de estudio personalizado basado en tu disponibilidad, experiencia previa y fecha del examen usando el **Método Selvia v0**.

## 🚀 Inicio Rápido

### Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Construir para producción
npm run build

# Ejecutar en producción
npm start

# Ejecutar tests
npm test

# Ejecutar tests en modo watch
npm run test:watch
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
/app
  page.tsx                # Página de inicio (landing)
  layout.tsx              # Layout raíz
  globals.css             # Estilos globales con Tailwind
  /calculator
    page.tsx              # Formulario de entrada
  /results
    page.tsx              # Visualización del plan generado

/components
  FormField.tsx           # Componente wrapper para campos de formulario
  WeekdayHoursInput.tsx   # Input para horas semanales (7 días)
  DayCard.tsx             # Tarjeta de día individual
  StudyBlockChip.tsx      # Chip de bloque de estudio con color de fase
  WeekSummaryRow.tsx      # Fila de resumen semanal
  PhaseBar.tsx            # Barra visual de distribución de fases
  ExplanationList.tsx     # Lista de explicaciones del plan

/lib
  /engine                 # Motor de generación de planes (lógica de negocio)
    types.ts              # Interfaces TypeScript (API estable)
    rules.ts              # Constantes y configuraciones del Método Selvia
    generator.ts          # generatePlan() - algoritmo principal
    explain.ts            # generateExplanations() - explicaciones legibles
    diagnostics.ts        # Evaluación diagnóstica y estimación de dominio
    __tests__
      generator.test.ts   # Tests unitarios (9+ tests)

  /utils
    date.ts               # Utilidades de fecha/hora
```

## 🧠 Arquitectura del Motor

### Motor de Generación (`/lib/engine`)

Toda la lógica de negocio está centralizada en el motor, completamente separada de los componentes React.

#### `types.ts`
Define todas las interfaces TypeScript del plan:
- `FormInputs`: Entradas del usuario
- `Plan`: Plan completo generado
- `DayPlan`: Plan de un día
- `StudyBlock`: Bloque individual de estudio
- `WeeklySummary`: Resumen semanal
- Etc.

#### `rules.ts`
Configuración centralizada del Método Selvia v0:
- `UNIT_COUNT = 20`: Número de unidades
- `MAX_BLOCK_DURATION = 60`: Duración máxima de bloque (minutos)
- `REVIEW_48H_WINDOW = 2`: Ventana de repaso de 48h (best-effort)
- `REVIEW_14D_HARD_LIMIT = 14`: Límite duro de 14 días (garantizado)
- `PHASE_DEFINITIONS`: Definiciones de las 4 fases
- Etc.

#### `generator.ts`
Función principal `generatePlan(inputs, options?)`:

**Características:**
- **Determinista**: Mismas entradas → mismo plan
- **Testeable**: `options.todayISO` permite fijar la fecha "hoy" para tests
- **Reglas de disponibilidad**:
  - 0 horas: Día de descanso (sin bloques)
  - < 30 min: Solo bloque de cuestionario
  - Normal: Cuestionario diario + bloques adicionales (2-4 bloques, max 60 min cada uno)

**Algoritmo:**
1. Calcula días hasta el examen
2. Si `alreadyStudying=true`: programa evaluación diagnóstica (días 0-4)
3. Para cada día:
   - Prioriza cuestionario diario (siempre primero)
   - Revisa límite de 14 días (hard guarantee) → fuerza revisión
   - Revisa repaso de 48h (best-effort) → agenda si hay tiempo
   - Añade contenido nuevo/revisión según rotación
   - Intercala fases según posición en el plan
4. Genera resúmenes semanales
5. Genera explicaciones legibles

#### `diagnostics.ts`
Maneja la evaluación diagnóstica cuando `alreadyStudying=true`:
- `scheduleDiagnostics()`: Determina días de evaluación (3-5 días)
- `estimateMastery()`: Heurística determinista de dominio por unidad (0-100)

#### `explain.ts`
Genera explicaciones humanas del plan (en español):
- Por qué cuestionario diario
- Sistema de repaso de 48h y 14 días
- Evaluación diagnóstica (si aplica)
- Aumento de práctica si `presentedBefore=true`
- Etc.

### Flujo de Datos

1. **Formulario** (`/calculator`) → Valida entradas → Codifica en URL (base64) o `sessionStorage`
2. **Resultados** (`/results`) → Decodifica entradas → Llama `generatePlan()` → Renderiza plan
3. **Motor** → Genera plan determinista → Devuelve `Plan` con días, resúmenes, explicaciones

### Almacenamiento de Datos (V0)

- **No hay base de datos**: Solo memoria/sessionStorage
- **Solo entradas del formulario** se codifican en URL o sessionStorage
- **El plan nunca se almacena**: Se genera on-demand desde las entradas
- **Fallback automático**: Si URL > 2000 chars, usa `sessionStorage` automáticamente

## 🧪 Tests

Ejecuta los tests con:

```bash
npm test
```

Los tests verifican:
1. Cada día con disponibilidad empieza con cuestionario
2. Ningún bloque excede 60 minutos
3. Repaso de 48h es best-effort (se agenda si hay tiempo)
4. Garantía de 14 días (hard) para planes >= 15 días
5. `alreadyStudying=true` activa diagnósticos y genera `masteryByUnit`
6. `presentedBefore=true` aumenta P4 en semanas finales
7. Planes cortos (<=7 días) son válidos
8. Días con 0 horas producen bloques vacíos
9. Días con baja disponibilidad (<30 min) solo tienen cuestionario

**Todos los tests usan fechas fijadas** (`todayISO: "2025-01-01"`) para determinismo.

## 🎨 UI

- **Tailwind CSS**: Solo Tailwind, sin librerías de componentes
- **Responsive**: Adaptado a móvil, tablet y desktop
- **Colores de fase**:
  - P1 (Contexto): Azul (`bg-blue-500`)
  - P2 (Profundidad): Ámbar (`bg-amber-500`)
  - P3 (Evaluación): Verde (`bg-emerald-500`)
  - P4 (Práctica): Púrpura (`bg-purple-500`)

## 🔮 Roadmap: Extensión a V1 y V2

### V1: Autenticación y Base de Datos

**Objetivo**: Persistencia de planes y usuarios.

**Cambios necesarios**:
1. **Backend API** (Next.js API routes o servidor externo):
   - `/api/auth`: Autenticación (NextAuth.js o similar)
   - `/api/plans`: CRUD de planes
   - `/api/users`: Gestión de usuarios

2. **Base de datos** (PostgreSQL/MySQL/Supabase):
   - Tabla `users`: id, email, name, createdAt
   - Tabla `plans`: id, userId, inputs (JSON), generatedAt
   - Tabla `progress`: id, planId, unit, mastery, lastStudied

3. **Frontend**:
   - Página `/login` y `/register`
   - Middleware de autenticación
   - Guardar plan en BD al generar
   - Historial de planes en `/plans`

4. **Motor**: Sin cambios (sigue siendo determinista y testeable)

**Migración desde V0**:
- Los planes existentes en `sessionStorage` se pueden migrar al guardarlos en BD
- El motor (`/lib/engine`) permanece intacto

### V2: Feedback y Recalculación Dinámica

**Objetivo**: Ajustar el plan según el progreso real del usuario.

**Cambios necesarios**:
1. **Feedback del usuario**:
   - Input: "¿Has completado este bloque?" (sí/no)
   - Input: "¿Cómo de difícil fue?" (1-5)
   - Input: "Tiempo real dedicado" (minutos)

2. **Recalculación del motor**:
   - Nueva función: `recalculatePlan(originalPlan, feedback[], todayISO)`
   - Ajusta `masteryByUnit` basado en feedback
   - Prioriza repaso de unidades con bajo dominio
   - Reajusta bloques futuros según progreso real

3. **Base de datos (V1)**:
   - Tabla `feedback`: id, planId, blockId, completed, difficulty, actualMinutes, createdAt
   - Query: `getFeedbackForPlan(planId)` → `recalculatePlan()`

4. **UI**:
   - Checkboxes "Completado" en bloques pasados
   - Botón "Actualizar plan" que recalculadora
   - Indicadores visuales de progreso (% completado)

**Motor extensible**:
- `generator.ts` ya soporta `options.todayISO` → se puede usar `recalculatePlan()` con fecha actualizada
- `diagnostics.ts` puede ajustar `estimateMastery()` basado en feedback real

## 📝 Notas de Implementación

- **Determinismo**: El motor es completamente determinista (mismas entradas → mismo plan)
- **Sin efectos secundarios**: No hay llamadas a APIs externas ni mutaciones globales
- **Testeable**: Toda la lógica está en `/lib/engine` y es fácilmente testeable
- **Type-safe**: TypeScript estricto en todo el código
- **Mínimas dependencias**: Solo Next.js, React, Tailwind, Vitest

## 📄 Licencia

Este proyecto es privado y de uso interno.
