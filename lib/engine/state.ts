/**
 * StudentState for feedback-driven replanning.
 *
 * Architecture:
 * - StudentState.done tracks historical completions (for future feedback persistence)
 * - During plan generation, activation/gating is based on SCHEDULED progress within
 *   that generation pass (tracked in GlobalBudget.unitTheoryRemaining[k].studyThemeDone)
 * - Pass 1: done is always 0; activation is purely based on scheduled-so-far
 * - Pass 2+: done can be non-zero from feedback events; scheduled-so-far starts from done
 *
 * Slack/buffer:
 * - Uses capacity.availableEffectiveMinutes which EXCLUDES final 2 weeks
 *   (effectivePlanningWeeks = totalWeeks - 2)
 * - slackMinutes = availableEffectiveMinutes - requiredMinutesFuture
 */

import type { FormInputs, PlanCapacity, ActivityType } from "./types";
import {
  STUDY_THEME_MINUTES,
  REVIEW_MINUTES,
  PODCAST_MINUTES,
  FLASHCARD_MINUTES,
  QUIZ_MAX_MINUTES,
} from "./rules";
import { getNowISO } from "../utils/date";

// ============================================================================
// Types
// ============================================================================

/** Per-unit activity minutes tracking */
export interface UnitMinutes {
  studyTheme: number;
  review: number;
  podcast: number;
  flashcard: number;
  quiz: number;
}

/** Per-unit state within StudentState */
export interface UnitState {
  unitId: string;
  required: UnitMinutes;
  done: UnitMinutes;
}

/** Global non-unit-specific state */
export interface GlobalState {
  casesRequired: number;
  casesDone: number;
  programmingRequired: number;
  programmingDone: number;
}

/**
 * Slack/buffer information.
 * effectiveCapacityFuture uses capacity.availableEffectiveMinutes which
 * EXCLUDES the final 2 weeks (effectivePlanningWeeks = totalWeeks - 2).
 */
export interface SlackInfo {
  /** Total available minutes in effective planning period (excludes final 2 weeks) */
  effectiveCapacityFuture: number;
  /** Total required minutes (theory + cases + programming) */
  requiredMinutesFuture: number;
  /** effectiveCapacityFuture - requiredMinutesFuture */
  slackMinutes: number;
  /** slackMinutes / effectiveCapacityFuture */
  slackRatio: number;
  /** good (>=20%), edge (>=10%), warning (<10%) */
  status: "good" | "edge" | "warning";
}

/** Full student state for replanning */
export interface StudentState {
  meta: {
    version: number;
    createdAt: string;
    todayISO: string;
    examDate: string;
  };
  units: Record<string, UnitState>;
  global: GlobalState;
  slack: SlackInfo;
  prefs: {
    targetMinutesByActivity: Record<ActivityType, number>;
  };
}

// ============================================================================
// Feedback Events
// ============================================================================

/** Quiz result feedback event */
export interface QuizResultEvent {
  type: "QUIZ_RESULT";
  dateISO: string;
  unit: string;
  /** Score 0-100 */
  score: number;
}

/** Block completed feedback event */
export interface BlockCompletedEvent {
  type: "BLOCK_COMPLETED";
  dateISO: string;
  blockId: string;
  activity: ActivityType;
  unit: string | null;
  completedMinutes: number;
}

export type SessionFeel = "too_much" | "ok" | "more";

/** Session feedback event (chunk-size adjustment for future blocks of same activity) */
export interface SessionFeedbackEvent {
  type: "SESSION_FEEDBACK";
  dateISO: string;
  blockId: string;
  activity: ActivityType;
  feel: SessionFeel;
}

/** Feedback event types */
export type FeedbackEventType = "QUIZ_RESULT" | "BLOCK_COMPLETED" | "SESSION_FEEDBACK";

export type FeedbackEvent = QuizResultEvent | BlockCompletedEvent | SessionFeedbackEvent;

// ============================================================================
// Constants
// ============================================================================

/** Score threshold below which a quiz is considered failed */
export const QUIZ_FAIL_THRESHOLD = 60;

/** Additional review minutes added when quiz fails */
export const REVIEW_BOOST_MINUTES = 30;

/** Default target block duration (minutes) per activity for chunk sizing */
export const ACTIVITY_TARGET_DEFAULTS: Record<ActivityType, number> = {
  STUDY_THEME: 60,
  REVIEW: 30,
  PODCAST: 60,
  FLASHCARD: 30,
  QUIZ: 15,
  CASE_PRACTICE: 60,
  CASE_MOCK: 60,
  PROGRAMMING_BLOCK: 60,
};

/** Min/max bounds for target block duration per activity */
export const ACTIVITY_BOUNDS: Record<ActivityType, { min: number; max: number }> = {
  STUDY_THEME: { min: 30, max: 90 },
  REVIEW: { min: 15, max: 60 },
  PODCAST: { min: 30, max: 90 },
  FLASHCARD: { min: 15, max: 60 },
  QUIZ: { min: 10, max: 30 },
  CASE_PRACTICE: { min: 30, max: 90 },
  CASE_MOCK: { min: 30, max: 90 },
  PROGRAMMING_BLOCK: { min: 30, max: 90 },
};

export const SESSION_FEEDBACK_STEP = 15;

// ============================================================================
// Functions
// ============================================================================

/**
 * Compute total required minutes from state (for slack calculation).
 */
function computeTotalRequired(state: StudentState): number {
  let total = 0;
  for (const unitState of Object.values(state.units)) {
    const r = unitState.required;
    total += r.studyTheme + r.review + r.podcast + r.flashcard + r.quiz;
  }
  total += state.global.casesRequired + state.global.programmingRequired;
  return total;
}

/**
 * Compute total done minutes from state.
 */
function computeTotalDone(state: StudentState): number {
  let total = 0;
  for (const unitState of Object.values(state.units)) {
    const d = unitState.done;
    total += d.studyTheme + d.review + d.podcast + d.flashcard + d.quiz;
  }
  total += state.global.casesDone + state.global.programmingDone;
  return total;
}

/**
 * Recompute slack info based on current required/done and capacity.
 */
function computeSlack(
  effectiveCapacity: number,
  requiredTotal: number,
  doneTotal: number
): SlackInfo {
  const requiredFuture = Math.max(0, requiredTotal - doneTotal);
  const slackMinutes = effectiveCapacity - requiredFuture;
  const slackRatio = effectiveCapacity > 0 ? slackMinutes / effectiveCapacity : 0;
  const status: SlackInfo["status"] =
    slackRatio >= 0.2 ? "good" : slackRatio >= 0.1 ? "edge" : "warning";

  return {
    effectiveCapacityFuture: effectiveCapacity,
    requiredMinutesFuture: requiredFuture,
    slackMinutes,
    slackRatio,
    status,
  };
}

/**
 * Derive initial StudentState from form inputs and capacity.
 *
 * - Initializes required minutes with baseline targets per unit
 * - Initializes done minutes to 0 (Pass 1: no historical tracking)
 * - Computes slack using capacity.availableEffectiveMinutes (excludes final 2 weeks)
 *
 * Note: Activation/gating during plan generation is based on scheduled-so-far
 * (tracked in GlobalBudget), not on StudentState.done.
 */
export function deriveInitialState(
  inputs: FormInputs,
  capacity: PlanCapacity,
  todayISO: string
): StudentState {
  const units: Record<string, UnitState> = {};

  for (let i = 1; i <= capacity.unitsCount; i++) {
    const unitId = `Unidad ${i}`;
    units[unitId] = {
      unitId,
      required: {
        studyTheme: STUDY_THEME_MINUTES,
        review: REVIEW_MINUTES,
        podcast: PODCAST_MINUTES,
        flashcard: FLASHCARD_MINUTES,
        quiz: QUIZ_MAX_MINUTES,
      },
      done: {
        studyTheme: 0,
        review: 0,
        podcast: 0,
        flashcard: 0,
        quiz: 0,
      },
    };
  }

  const global: GlobalState = {
    casesRequired: capacity.casesPlanned,
    casesDone: 0,
    programmingRequired: capacity.programmingPlanned,
    programmingDone: 0,
  };

  // Build partial state to compute totals
  const partialState: StudentState = {
    meta: {
      version: 1,
      createdAt: getNowISO(),
      todayISO,
      examDate: inputs.examDate,
    },
    units,
    global,
    slack: {
      effectiveCapacityFuture: 0,
      requiredMinutesFuture: 0,
      slackMinutes: 0,
      slackRatio: 0,
      status: "warning",
    },
    prefs: {
      targetMinutesByActivity: { ...ACTIVITY_TARGET_DEFAULTS },
    },
  };

  const requiredTotal = computeTotalRequired(partialState);
  const doneTotal = computeTotalDone(partialState);

  // capacity.availableEffectiveMinutes already excludes final 2 weeks
  partialState.slack = computeSlack(
    capacity.availableEffectiveMinutes,
    requiredTotal,
    doneTotal
  );

  return partialState;
}

/**
 * Apply feedback events to StudentState, returning updated state.
 *
 * Pass 1 supports QUIZ_RESULT:
 * - If score < QUIZ_FAIL_THRESHOLD (60), increase required.review by REVIEW_BOOST_MINUTES (30)
 *
 * Does NOT schedule anything; only updates state.
 * Recomputes slack after all events are processed.
 */
export function applyFeedbackEvents(
  state: StudentState,
  events: FeedbackEvent[]
): StudentState {
  // Deep clone to avoid mutation
  const newState: StudentState = JSON.parse(JSON.stringify(state));

  for (const event of events) {
    if (event.type === "QUIZ_RESULT") {
      const unitState = newState.units[event.unit];
      if (!unitState) continue;

      if (event.score < QUIZ_FAIL_THRESHOLD) {
        unitState.required.review += REVIEW_BOOST_MINUTES;
      }
    } else if (event.type === "BLOCK_COMPLETED") {
      const minutes = Math.max(0, Math.floor(event.completedMinutes));
      if (minutes === 0) continue;

      const { activity, unit } = event;

      if (
        activity === "STUDY_THEME" ||
        activity === "REVIEW" ||
        activity === "PODCAST" ||
        activity === "FLASHCARD" ||
        activity === "QUIZ"
      ) {
        if (!unit || !newState.units[unit]) {
          // eslint-disable-next-line no-console
          console.warn(`BLOCK_COMPLETED: unknown unit "${unit}" for ${activity}`);
          continue;
        }
        const unitState = newState.units[unit];
        switch (activity) {
          case "STUDY_THEME":
            unitState.done.studyTheme += minutes;
            break;
          case "REVIEW":
            unitState.done.review += minutes;
            break;
          case "PODCAST":
            unitState.done.podcast += minutes;
            break;
          case "FLASHCARD":
            unitState.done.flashcard += minutes;
            break;
          case "QUIZ":
            unitState.done.quiz += minutes;
            break;
        }
      } else if (activity === "CASE_PRACTICE" || activity === "CASE_MOCK") {
        newState.global.casesDone += minutes;
      } else if (activity === "PROGRAMMING_BLOCK") {
        newState.global.programmingDone += minutes;
      }
    } else if (event.type === "SESSION_FEEDBACK") {
      const { activity, feel } = event;
      const current = newState.prefs.targetMinutesByActivity[activity];
      const bounds = ACTIVITY_BOUNDS[activity];
      let newTarget = current;

      if (feel === "too_much") {
        newTarget = current - SESSION_FEEDBACK_STEP;
      } else if (feel === "more") {
        newTarget = current + SESSION_FEEDBACK_STEP;
      }

      newState.prefs.targetMinutesByActivity[activity] = Math.max(
        bounds.min,
        Math.min(bounds.max, newTarget)
      );
    }
  }

  // Recompute slack with same effective capacity
  const requiredTotal = computeTotalRequired(newState);
  const doneTotal = computeTotalDone(newState);
  newState.slack = computeSlack(
    state.slack.effectiveCapacityFuture,
    requiredTotal,
    doneTotal
  );

  return newState;
}
