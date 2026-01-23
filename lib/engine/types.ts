/**
 * Core TypeScript types for Selvia ISP Calculator Engine
 * Stable API - maintain backward compatibility
 */

export type SelviaPhase = "P1_CONTEXT" | "P2_DEPTH" | "P3_EVAL_REVIEW" | "P4_PRACTICE";

export type BlockType = "quiz" | "new_content" | "review" | "practice" | "recap" | "evaluation";

export type BlockFormat = "raw_content" | "summary" | "flashcards" | "audio" | "video" | "quiz";

export type Stage = "Infantil" | "Primaria";

/**
 * Activity types for Pass 1 allocation (50% Theory / 30% Cases / 20% Programming)
 */
export type ActivityType =
  | "STUDY_THEME"       // 240m per unit, must be first
  | "REVIEW"            // 60m per unit
  | "PODCAST"           // 60m per unit
  | "FLASHCARD"         // 60m per unit
  | "QUIZ"              // up to 90m per unit (soft cap)
  | "CASE_PRACTICE"     // 70% of casesPlanned
  | "CASE_MOCK"         // 30% of casesPlanned
  | "PROGRAMMING_BLOCK";

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
 * Capacity and planned workload (Pass 1).
 * theoryPlanned = unitsCount * 510; cases = 0.6 * theory; programming = 0.4 * theory; plannedMinutes = 2 * theory.
 */
export interface PlanCapacity {
  totalWeeks: number;
  effectivePlanningWeeks: number;
  availableEffectiveMinutes: number;
  unitsCount: number;
  theoryPlanned: number;
  casesPlanned: number;
  programmingPlanned: number;
  plannedMinutes: number;
  bufferMinutes: number;
  bufferRatio: number;
  bufferStatus: "good" | "edge" | "warning";
}

/**
 * Week-level actual minutes (observation only, not budgets)
 */
export interface WeeklyActual {
  weekIndex: number;
  weekStart: string;
  theoryMinutes: number;
  casesMinutes: number;
  programmingMinutes: number;
  totalMinutes: number;
  /** Streams with < 60m when global remaining > 0 */
  missingStreams: string[];
}

/**
 * Debug metadata for Pass 1 (capacity, allocation, guardrails)
 */
export interface PlanDebugInfo {
  capacity: PlanCapacity;
  theoryScheduled: number;
  casesScheduled: number;
  programmingScheduled: number;
  totalScheduled: number;
  theoryRatio: number;
  casesRatio: number;
  programmingRatio: number;
  weeklyActuals: WeeklyActual[];
  starvationWeeks: number;
  /** Weeks after week 2 with all 3 streams >= 60m */
  weeksWithFullPresence: number;
  /** Denominator for presence % */
  totalWeeksAfterTwo: number;
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
  debugInfo?: PlanDebugInfo;
}

/**
 * Diagnostic schedule for users already studying
 */
export interface DiagnosticSchedule {
  diagnosticDays: number[]; // Day indices (0-based) when diagnostics run
  totalDiagnosticDays: number; // 3-5 days depending on availability
}

