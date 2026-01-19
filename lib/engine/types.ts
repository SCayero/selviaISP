/**
 * Core TypeScript types for Selvia ISP Calculator Engine
 * Stable API - maintain backward compatibility
 */

export type SelviaPhase = "P1_CONTEXT" | "P2_DEPTH" | "P3_EVAL_REVIEW" | "P4_PRACTICE";

export type BlockType = "quiz" | "new_content" | "review" | "practice" | "recap" | "evaluation";

export type BlockFormat = "raw_content" | "summary" | "flashcards" | "audio" | "video" | "quiz";

export type Stage = "Infantil" | "Primaria";

export type ActivityType =
  | "THEME_STUDY"           // Theory study of a theme
  | "REPASO_BLOCK"          // Review/repaso session
  | "CASE_PRACTICE"         // Case practice (casos prácticos)
  | "PROGRAMMING"           // Programming unit (programación)
  | "SIM_THEORY"            // Theory simulation
  | "SIM_CASES"             // Cases simulation
  | "FEEDBACK_THEORY"       // Feedback review for theory sim
  | "FEEDBACK_CASES"        // Feedback review for cases sim
  | "FREE_STUDY"            // Fill residual minutes
  | "FINAL_REPASO_GENERAL"  // Final general review
  | "FINAL_SIM_THEORY"      // Final theory simulation
  | "FINAL_SIM_CASES";      // Final cases simulation

/**
 * User form inputs
 */
export interface FormInputs {
  examDate: string; // ISO date string (YYYY-MM-DD)
  availabilityHoursByWeekday: number[]; // [Mon, Tue, Wed, Thu, Fri, Sat, Sun], decimals allowed
  presentedBefore: boolean;
  alreadyStudying: boolean;
  region: string;
  stage: Stage;
  // New optional fields (defaults applied in generator)
  studentType?: "new" | "repeat";  // Default: inferred from presentedBefore
  themesCount?: 15 | 20 | 25;      // Default: 25
  planProgramming?: boolean;       // Default: true
}

/**
 * Generator options for deterministic testing
 */
export interface GeneratorOptions {
  todayISO?: string; // Pin "today" for deterministic tests, defaults to actual today
}

/**
 * Phase definition metadata
 */
export interface SelviaPhaseDefinition {
  id: SelviaPhase;
  name: string;
  description: string;
}

/**
 * Study block within a day
 */
export interface StudyBlock {
  selviaPhase: SelviaPhase;
  type: BlockType;
  unit: string | null; // Unit name like "Unidad 1", or null for general blocks
  format: BlockFormat;
  durationMinutes: number;
  notes: string; // Optional context notes
  // New optional fields (backward compatible)
  activity?: ActivityType;         // New activity classification
  caseNumber?: number;             // For CASE_PRACTICE (1-based)
  simulationNumber?: number;       // For SIM_* activities (1-based)
  pairedWithNext?: boolean;        // True if this block must be followed by feedback
}

/**
 * Plan for a single day
 */
export interface DayPlan {
  date: string; // ISO date string (YYYY-MM-DD)
  weekday: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  totalHours: number; // Sum of all block durations
  blocks: StudyBlock[];
}

/**
 * Weekly summary statistics
 */
export interface WeeklySummary {
  weekStartDate: string; // ISO date string (YYYY-MM-DD) for Monday of that week
  totalHours: number;
  allocationByPhase: Record<SelviaPhase, number>; // Minutes per phase
}

/**
 * Plan metadata
 */
export interface PlanMeta {
  generatedAt: string; // ISO datetime string
  today: string; // ISO date string (YYYY-MM-DD)
  examDate: string; // ISO date string (YYYY-MM-DD)
  region: string;
  stage: Stage;
  unitsTotal: number;
}

/**
 * Complete study plan
 */
export interface Plan {
  meta: PlanMeta;
  phases: SelviaPhaseDefinition[]; // Describes the 4 phases
  masteryByUnit: Record<string, number>; // 0-100 mastery score per unit
  days: DayPlan[];
  weeklySummaries: WeeklySummary[];
  explanations: string[]; // Human-readable explanation bullets
}

/**
 * Diagnostic schedule for users already studying
 */
export interface DiagnosticSchedule {
  diagnosticDays: number[]; // Day indices (0-based) when diagnostics run
  totalDiagnosticDays: number; // 3-5 days depending on availability
}

/**
 * Target configuration for activity scheduling
 */
export interface TargetConfig {
  hoursAvailable: number;          // Total hours until exam
  timeCondition: "comfortable" | "tight"; // >= 260h = comfortable
  casesTarget: number;             // Number of cases to complete
  programmingHoursTarget: number;  // Hours for programming
  repasosCount: number;            // Number of repaso sessions
  simTheoryCount: number;          // Number of theory simulations
  simCasesCount: number;           // Number of case simulations
  totalRequiredHours: number;      // Sum of all targets
  timeWarning: boolean;            // True if available < 90% of required
  additionalPool: number;          // Surplus hours for free study
}
