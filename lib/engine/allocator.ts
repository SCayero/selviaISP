/**
 * Pass 1 global remaining-ratio allocator.
 * Tracks theory/cases/programming remaining; selects stream with highest remaining ratio.
 * Weeks 1–2 theory-only; guardrails prevent extended starvation of cases/programming.
 */

import type { ActivityType, PlanCapacity } from "./types";
import {
  THEORY_ENVELOPE_MINUTES,
  STUDY_THEME_MINUTES,
  REVIEW_MINUTES,
  PODCAST_MINUTES,
  FLASHCARD_MINUTES,
  QUIZ_MAX_MINUTES,
} from "./rules";

export interface UnitTheoryBudget {
  studyThemeRemaining: number;
  reviewRemaining: number;
  podcastRemaining: number;
  flashcardRemaining: number;
  quizRemaining: number;
  totalRemaining: number;
  studyThemeComplete: boolean;
}

export interface GlobalBudget {
  theoryPlanned: number;
  casesPlanned: number;
  programmingPlanned: number;
  theoryRemaining: number;
  casesRemaining: number;
  programmingRemaining: number;
  casePracticeScheduled: number;
  caseMockScheduled: number;
  unitTheoryRemaining: Record<string, UnitTheoryBudget>;
}

export interface AllocatorContext {
  lastWeekCasesMinutes: number;
  lastWeekProgrammingMinutes: number;
  /** Current week state for smoothing (optional when using selectActivity only) */
  thisWeekTheory?: number;
  thisWeekCases?: number;
  thisWeekProg?: number;
  weekRemainingMinutes?: number;
  weekIndex?: number;
}

/** Weekly minimum presence per stream (minutes). */
export const WEEKLY_MINIMUM_MINUTES = 60;

function unitKey(i: number): string {
  return `Unidad ${i}`;
}

export function createGlobalBudget(capacity: PlanCapacity): GlobalBudget {
  const {
    theoryPlanned,
    casesPlanned,
    programmingPlanned,
    unitsCount,
  } = capacity;
  const unitTheoryRemaining: Record<string, UnitTheoryBudget> = {};
  for (let i = 1; i <= unitsCount; i++) {
    const k = unitKey(i);
    unitTheoryRemaining[k] = {
      studyThemeRemaining: STUDY_THEME_MINUTES,
      reviewRemaining: REVIEW_MINUTES,
      podcastRemaining: PODCAST_MINUTES,
      flashcardRemaining: FLASHCARD_MINUTES,
      quizRemaining: QUIZ_MAX_MINUTES,
      totalRemaining: THEORY_ENVELOPE_MINUTES,
      studyThemeComplete: false,
    };
  }
  return {
    theoryPlanned,
    casesPlanned,
    programmingPlanned,
    theoryRemaining: theoryPlanned,
    casesRemaining: casesPlanned,
    programmingRemaining: programmingPlanned,
    casePracticeScheduled: 0,
    caseMockScheduled: 0,
    unitTheoryRemaining,
  };
}

function firstUnitWithRemaining(budget: GlobalBudget): UnitTheoryBudget | null {
  const keys = Object.keys(budget.unitTheoryRemaining).sort(
    (a, b) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10)
  );
  for (const k of keys) {
    const u = budget.unitTheoryRemaining[k];
    if (u.totalRemaining > 0) return u;
  }
  return null;
}

export function selectTheoryActivity(budget: GlobalBudget): ActivityType | null {
  const unit = firstUnitWithRemaining(budget);
  if (!unit) return null;
  if (unit.studyThemeRemaining > 0) return "STUDY_THEME";
  if (unit.reviewRemaining > 0) return "REVIEW";
  if (unit.podcastRemaining > 0) return "PODCAST";
  if (unit.flashcardRemaining > 0) return "FLASHCARD";
  if (unit.quizRemaining > 0) return "QUIZ";
  return null;
}

function currentUnitKey(budget: GlobalBudget): string | null {
  const keys = Object.keys(budget.unitTheoryRemaining).sort(
    (a, b) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10)
  );
  for (const k of keys) {
    if (budget.unitTheoryRemaining[k].totalRemaining > 0) return k;
  }
  return null;
}

/** Current unit for theory blocks (first with remaining). Used by generator to set block.unit. */
export function getCurrentUnitKey(budget: GlobalBudget): string | null {
  return currentUnitKey(budget);
}

export function selectCasesActivity(budget: GlobalBudget): ActivityType {
  const casePracticeTarget = 0.7 * budget.casesPlanned;
  if (budget.casePracticeScheduled < casePracticeTarget) return "CASE_PRACTICE";
  return "CASE_MOCK";
}

export function selectActivity(
  budget: GlobalBudget,
  weekIndex: number,
  ctx?: AllocatorContext
): ActivityType | null {
  if (weekIndex <= 2) return selectTheoryActivity(budget);

  const tr = budget.theoryPlanned > 0 ? budget.theoryRemaining / budget.theoryPlanned : 0;
  const cr = budget.casesPlanned > 0 ? budget.casesRemaining / budget.casesPlanned : 0;
  const pr = budget.programmingPlanned > 0 ? budget.programmingRemaining / budget.programmingPlanned : 0;

  const preferCases = (ctx?.lastWeekCasesMinutes === 0 && budget.casesRemaining > 0);
  const preferProg = (ctx?.lastWeekProgrammingMinutes === 0 && budget.programmingRemaining > 0);

  let stream: "theory" | "cases" | "programming" | null = null;
  if (preferCases && cr > 0) stream = "cases";
  else if (preferProg && pr > 0) stream = "programming";
  else {
    const best = Math.max(tr, cr, pr);
    if (best <= 0) return null;
    if (tr === best && budget.theoryRemaining > 0) stream = "theory";
    else if (cr === best && budget.casesRemaining > 0) stream = "cases";
    else if (pr === best && budget.programmingRemaining > 0) stream = "programming";
  }

  if (stream === "theory") return selectTheoryActivity(budget);
  if (stream === "cases") return selectCasesActivity(budget);
  if (stream === "programming") return "PROGRAMMING_BLOCK";
  return null;
}

/**
 * Like selectActivity but applies weekly minimum presence and end-of-week forcing.
 * Use for weekIndex > 2; otherwise same as selectTheoryActivity.
 * Requires thisWeekTheory/Cases/Prog, weekRemainingMinutes, weekIndex in ctx.
 */
export function selectActivityWithSmoothing(
  budget: GlobalBudget,
  ctx: AllocatorContext
): ActivityType | null {
  const wi = ctx.weekIndex ?? 0;
  if (wi <= 2) return selectTheoryActivity(budget);

  const MIN = WEEKLY_MINIMUM_MINUTES;
  const tw = ctx.thisWeekTheory ?? 0;
  const cw = ctx.thisWeekCases ?? 0;
  const pw = ctx.thisWeekProg ?? 0;
  const wr = ctx.weekRemainingMinutes ?? 0;

  const missingTheory = tw < MIN && budget.theoryRemaining > 0;
  const missingCases = cw < MIN && budget.casesRemaining > 0;
  const missingProg = pw < MIN && budget.programmingRemaining > 0;

  if (wr <= 120) {
    if (missingCases) return selectCasesActivity(budget);
    if (missingProg) return "PROGRAMMING_BLOCK";
    if (missingTheory) return selectTheoryActivity(budget);
  }

  if (missingCases && cw <= tw && cw <= pw) return selectCasesActivity(budget);
  if (missingProg && pw <= tw && pw <= cw) return "PROGRAMMING_BLOCK";
  if (missingTheory && tw <= cw && tw <= pw) return selectTheoryActivity(budget);

  return selectActivity(budget, wi, ctx);
}

export function updateGlobalBudget(
  budget: GlobalBudget,
  activity: ActivityType,
  minutes: number
): void {
  switch (activity) {
    case "STUDY_THEME": {
      budget.theoryRemaining -= minutes;
      const k = currentUnitKey(budget);
      if (!k) break;
      const u = budget.unitTheoryRemaining[k];
      u.studyThemeRemaining = Math.max(0, u.studyThemeRemaining - minutes);
      u.totalRemaining = Math.max(0, u.totalRemaining - minutes);
      if (u.studyThemeRemaining <= 0) u.studyThemeComplete = true;
      break;
    }
    case "REVIEW":
    case "PODCAST":
    case "FLASHCARD":
    case "QUIZ": {
      budget.theoryRemaining -= minutes;
      const k = currentUnitKey(budget);
      if (!k) break;
      const u = budget.unitTheoryRemaining[k];
      if (activity === "REVIEW") u.reviewRemaining = Math.max(0, u.reviewRemaining - minutes);
      else if (activity === "PODCAST") u.podcastRemaining = Math.max(0, u.podcastRemaining - minutes);
      else if (activity === "FLASHCARD") u.flashcardRemaining = Math.max(0, u.flashcardRemaining - minutes);
      else if (activity === "QUIZ") u.quizRemaining = Math.max(0, u.quizRemaining - minutes);
      u.totalRemaining = Math.max(0, u.totalRemaining - minutes);
      break;
    }
    case "CASE_PRACTICE":
      budget.casesRemaining -= minutes;
      budget.casePracticeScheduled += minutes;
      break;
    case "CASE_MOCK":
      budget.casesRemaining -= minutes;
      budget.caseMockScheduled += minutes;
      break;
    case "PROGRAMMING_BLOCK":
      budget.programmingRemaining -= minutes;
      break;
  }
}
