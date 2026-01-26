/**
 * Selvia Method V0 - Configuration and Rules
 * Centralized constants and phase definitions
 */

import type { SelviaPhaseDefinition, SelviaPhase, BlockFormat } from "./types";

/**
 * Total number of units to cover
 */
export const UNIT_COUNT = 20;

/**
 * Unit names (configurable)
 */
export const UNIT_NAMES: string[] = Array.from({ length: UNIT_COUNT }, (_, i) => `Unidad ${i + 1}`);

/**
 * Timeboxing rules
 */
export const MAX_BLOCK_DURATION = 60; // minutes
export const MIN_BLOCK_DURATION = 15; // minutes
export const BLOCKS_PER_DAY = { min: 2, max: 4 };

/**
 * Review cadence rules
 */
export const REVIEW_48H_WINDOW = 2; // days (best-effort, not guaranteed)
export const REVIEW_14D_HARD_LIMIT = 14; // days (hard guarantee)

/**
 * Diagnostic scheduling
 */
export const DIAGNOSTIC_DAYS = { min: 3, max: 5 }; // Days to allocate for diagnostics

/**
 * Low availability thresholds
 */
export const LOW_AVAILABILITY_THRESHOLD = 30; // minutes - below this, only quiz block
export const QUIZ_BLOCK_DURATION = 15; // minutes - standard quiz duration

/**
 * Unit study budget (legacy, used by some tests)
 */
export const TARGET_MINUTES_PER_UNIT = 240;
export const MAX_NEW_UNITS_PER_DAY = 1;

/**
 * Pass 1: Theory envelope per unit (50% of planned total).
 * theoryPlanned = unitsCount * THEORY_ENVELOPE_MINUTES.
 * Cases = 0.6 * theory, programming = 0.4 * theory.
 */
export const THEORY_ENVELOPE_MINUTES = 510;

/**
 * Per-unit theory activity durations (within 510m envelope)
 */
export const STUDY_THEME_MINUTES = 240;   // must be first per unit
export const START_NEXT_UNIT_THRESHOLD = 120;   // Unit N+1 eligible after Unit N has >=120m STUDY_THEME
export const STUDY_THEME_COMPLETE_THRESHOLD = 240; // REVIEW unlocks after this
export const REVIEW_MINUTES = 60;
export const PODCAST_MINUTES = 60;
export const FLASHCARD_MINUTES = 60;
export const QUIZ_MAX_MINUTES = 90;      // soft cap

/**
 * REPASO budget ratio (Pass 2)
 */
export const REPASO_BUDGET_RATIO = 0.25;

/**
 * Selvia Phase Definitions
 */
export const PHASE_DEFINITIONS: SelviaPhaseDefinition[] = [
  {
    id: "P1_CONTEXT",
    name: "Contextualización",
    description: "Overview and contextual understanding of topics",
  },
  {
    id: "P2_DEPTH",
    name: "Profundización",
    description: "In-depth preparation and detailed study",
  },
  {
    id: "P3_EVAL_REVIEW",
    name: "Evaluación y Repaso",
    description: "Evaluation, quizzes, and review sessions",
  },
  {
    id: "P4_PRACTICE",
    name: "Ejercicios Prácticos",
    description: "Practical exercises and application",
  },
];

/**
 * Phase color mapping for UI (using Selvia design tokens)
 * Adapted to work with Selvia palette (primary green + accent orange)
 */
export const PHASE_COLORS: Record<SelviaPhase, string> = {
  P1_CONTEXT: "bg-primary", // Use primary green
  P2_DEPTH: "bg-[#6FD99F]", // Slightly darker green variant
  P3_EVAL_REVIEW: "bg-accent", // Use accent orange
  P4_PRACTICE: "bg-[#41C77A]", // Use primary-hover green
};

/**
 * Phase label mapping for UI
 */
export const PHASE_LABELS: Record<SelviaPhase, string> = {
  P1_CONTEXT: "P1: Contexto",
  P2_DEPTH: "P2: Profundidad",
  P3_EVAL_REVIEW: "P3: Evaluación",
  P4_PRACTICE: "P4: Práctica",
};

/**
 * Format rotation patterns (for variety in study formats)
 */
export const FORMAT_ROTATION: Record<string, BlockFormat[]> = {
  new_content: ["raw_content", "summary"],
  reinforcement: ["flashcards", "quiz"],
  deeper: ["video", "audio"], // Alternates
  weekly_recap: ["quiz", "summary"],
};
