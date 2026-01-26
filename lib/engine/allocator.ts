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
  START_NEXT_UNIT_THRESHOLD,
  STUDY_THEME_COMPLETE_THRESHOLD,
} from "./rules";

export interface UnitTheoryBudget {
  studyThemeRemaining: number;
  studyThemeDone: number;
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
  /** Overlap V1: daily STUDY_THEME cap and one-unit-per-day */
  studyThemeTodayUnit?: string | null;
  studyThemeTodayMinutes?: number;
  availableMinutesToday?: number;
  /** When doing secondary for a unit other than today's STUDY_THEME unit (interleaving) */
  theoryUnitOverride?: string | null;
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
      studyThemeDone: 0,
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

function sortedUnitKeys(budget: GlobalBudget): string[] {
  return Object.keys(budget.unitTheoryRemaining).sort(
    (a, b) => parseInt(a.replace(/\D/g, ""), 10) - parseInt(b.replace(/\D/g, ""), 10)
  );
}

function firstUnitWithRemaining(budget: GlobalBudget): UnitTheoryBudget | null {
  for (const k of sortedUnitKeys(budget)) {
    const u = budget.unitTheoryRemaining[k];
    if (u.totalRemaining > 0) return u;
  }
  return null;
}

/** First unit eligible for STUDY_THEME today: has remaining, prev >= 120, and one-per-day. */
function firstEligiblePrimaryUnit(
  budget: GlobalBudget,
  ctx: Pick<AllocatorContext, "studyThemeTodayUnit">
): string | null {
  const keys = sortedUnitKeys(budget);
  const locked = ctx.studyThemeTodayUnit ?? null;
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const u = budget.unitTheoryRemaining[k];
    if (u.studyThemeRemaining <= 0) continue;
    const prevKey = i > 0 ? keys[i - 1] : null;
    const prevDone = prevKey ? (budget.unitTheoryRemaining[prevKey]?.studyThemeDone ?? 0) : 0;
    if (prevKey && prevDone < START_NEXT_UNIT_THRESHOLD) continue;
    if (locked !== null && locked !== k) continue;
    return k;
  }
  return null;
}

/**
 * Secondary theory (P/F/Q/REVIEW) for a given unit.
 * Unit must be activated: studyThemeDone > 0 OR is today's STUDY_THEME unit (same-day activation).
 * REVIEW only after 240m STUDY_THEME.
 */
function selectSecondaryForUnit(
  budget: GlobalBudget,
  unitKey: string,
  todayUnit?: string | null
): ActivityType | null {
  const u = budget.unitTheoryRemaining[unitKey];
  if (!u || u.totalRemaining <= 0) return null;

  const isActivated = (u.studyThemeDone ?? 0) > 0;
  const isTodayUnit = todayUnit != null && todayUnit === unitKey;
  if (!isActivated && !isTodayUnit) return null;

  const canReview = (u.studyThemeDone ?? 0) >= STUDY_THEME_COMPLETE_THRESHOLD && u.reviewRemaining > 0;
  if (canReview) return "REVIEW";
  if (u.podcastRemaining > 0) return "PODCAST";
  if (u.flashcardRemaining > 0) return "FLASHCARD";
  if (u.quizRemaining > 0) return "QUIZ";
  return null;
}

/** Units with studyThemeDone > 0 (started). */
function activeUnitKeys(budget: GlobalBudget): string[] {
  return sortedUnitKeys(budget).filter(
    (k) => (budget.unitTheoryRemaining[k].studyThemeDone ?? 0) > 0
  );
}

/**
 * Prefer secondary for a unit other than todayUnit when >=2 active.
 * Only considers activated units (+ todayUnit for same-day activation).
 * Mutates ctx.theoryUnitOverride. Accepts partial ctx for overlap fields only.
 */
function selectSecondaryWithInterleaving(
  budget: GlobalBudget,
  todayUnit: string | null,
  ctx: Pick<AllocatorContext, "theoryUnitOverride"> & Partial<AllocatorContext>
): ActivityType | null {
  const active = activeUnitKeys(budget);
  const preferOther = active.length >= 2 && todayUnit != null;
  const activatedSet = new Set(active);
  if (todayUnit) activatedSet.add(todayUnit);
  const keys = sortedUnitKeys(budget).filter((k) => activatedSet.has(k));
  const order = preferOther
    ? keys.filter((k) => k !== todayUnit).concat(keys.filter((k) => k === todayUnit))
    : keys;
  for (const k of order) {
    const act = selectSecondaryForUnit(budget, k, todayUnit);
    if (!act) continue;
    if (preferOther && k !== todayUnit) {
      ctx.theoryUnitOverride = k;
      return act;
    }
    ctx.theoryUnitOverride = undefined;
    return act;
  }
  return null;
}

function theoryCap(ctx: Partial<AllocatorContext>): number {
  const avail = ctx.availableMinutesToday ?? 0;
  if (avail >= 240) return Math.floor(avail * 0.5);
  return Math.min(avail, 120);
}

/**
 * Theory activity selection with overlap V1 rules: daily STUDY_THEME cap,
 * one unit per day for STUDY_THEME, secondary allowed after start, REVIEW after 240.
 * Mutates ctx.studyThemeTodayUnit when selecting first STUDY_THEME of the day.
 * Legacy: when ctx has no availableMinutesToday, uses simple priority (STUDY_THEME first).
 */
export function selectTheoryActivity(
  budget: GlobalBudget,
  ctx?: AllocatorContext
): ActivityType | null {
  const c: Partial<AllocatorContext> = ctx ?? {};
  if (c.availableMinutesToday == null) {
    const unit = firstUnitWithRemaining(budget);
    if (!unit) return null;
    const k = sortedUnitKeys(budget).find((key) => budget.unitTheoryRemaining[key] === unit) ?? null;
    if (!k) return null;
    if (unit.studyThemeRemaining > 0) return "STUDY_THEME";
    return selectSecondaryForUnit(budget, k, undefined);
  }

  const todayUnit = c.studyThemeTodayUnit ?? null;
  const todayMins = c.studyThemeTodayMinutes ?? 0;
  const cap = theoryCap(c);

  const cac = c as AllocatorContext;
  if (todayMins >= cap) {
    const unit = todayUnit;
    if (!unit) return null;
    const act = selectSecondaryWithInterleaving(budget, unit, cac);
    if (act) return act;
    cac.theoryUnitOverride = undefined;
    return selectSecondaryForUnit(budget, unit, todayUnit);
  }

  const primary = firstEligiblePrimaryUnit(budget, cac);
  if (primary && budget.unitTheoryRemaining[primary].studyThemeRemaining > 0) {
    if (c && !todayUnit) (c as AllocatorContext).studyThemeTodayUnit = primary;
    cac.theoryUnitOverride = undefined;
    return "STUDY_THEME";
  }

  if (todayUnit) {
    const act = selectSecondaryWithInterleaving(budget, todayUnit, cac);
    if (act) return act;
  }

  const activatedUnits = activeUnitKeys(budget);
  if (todayUnit && !activatedUnits.includes(todayUnit)) {
    activatedUnits.push(todayUnit);
  }
  for (const k of activatedUnits) {
    const act = selectSecondaryForUnit(budget, k, todayUnit);
    if (act) {
      cac.theoryUnitOverride = undefined;
      return act;
    }
  }
  return null;
}

function currentUnitKey(budget: GlobalBudget, ctx?: AllocatorContext): string | null {
  const c = ctx as AllocatorContext | undefined;
  if (c?.theoryUnitOverride != null) return c.theoryUnitOverride;
  if (c?.studyThemeTodayUnit) return c.studyThemeTodayUnit;
  for (const k of sortedUnitKeys(budget)) {
    if (budget.unitTheoryRemaining[k].totalRemaining > 0) return k;
  }
  return null;
}

/** Current unit for theory blocks. Uses ctx.studyThemeTodayUnit when set (overlap V1). */
export function getCurrentUnitKey(budget: GlobalBudget, ctx?: AllocatorContext): string | null {
  return currentUnitKey(budget, ctx);
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
  if (weekIndex <= 2) return selectTheoryActivity(budget, ctx);

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

  if (stream === "theory") return selectTheoryActivity(budget, ctx);
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
  if (wi <= 2) return selectTheoryActivity(budget, ctx);

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
    if (missingTheory) return selectTheoryActivity(budget, ctx);
  }

  if (missingCases && cw <= tw && cw <= pw) return selectCasesActivity(budget);
  if (missingProg && pw <= tw && pw <= cw) return "PROGRAMMING_BLOCK";
  if (missingTheory && tw <= cw && tw <= pw) return selectTheoryActivity(budget, ctx);

  return selectActivity(budget, wi, ctx);
}

export function updateGlobalBudget(
  budget: GlobalBudget,
  activity: ActivityType,
  minutes: number,
  unitOverride?: string | null,
  ctx?: AllocatorContext
): void {
  const resolveUnit = () => unitOverride ?? currentUnitKey(budget, ctx);
  switch (activity) {
    case "STUDY_THEME": {
      budget.theoryRemaining -= minutes;
      const k = resolveUnit();
      if (!k) break;
      const u = budget.unitTheoryRemaining[k];
      u.studyThemeRemaining = Math.max(0, u.studyThemeRemaining - minutes);
      u.studyThemeDone = (u.studyThemeDone ?? 0) + minutes;
      u.totalRemaining = Math.max(0, u.totalRemaining - minutes);
      if (u.studyThemeRemaining <= 0) u.studyThemeComplete = true;
      break;
    }
    case "REVIEW":
    case "PODCAST":
    case "FLASHCARD":
    case "QUIZ": {
      budget.theoryRemaining -= minutes;
      const k = resolveUnit();
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
