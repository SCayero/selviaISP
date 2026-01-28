/**
 * Selvia Method V0 - Core Plan Generator (Pass 1)
 * Uses capacity + global remaining-ratio allocator. No weekly budgets or unlocks.
 *
 * Architecture:
 * - generatePlan: backward-compatible wrapper (derives initial state, then calls generatePlanFromState)
 * - generatePlanFromState: core generator that consumes StudentState
 * - createBudgetFromState: converts StudentState to GlobalBudget for allocator
 *
 * Activation/gating:
 * - Based on SCHEDULED progress within the current generation pass
 * - GlobalBudget.unitTheoryRemaining[k].studyThemeDone tracks scheduled-so-far (starts from state.done)
 * - Allocator increments studyThemeDone as blocks are scheduled
 * - Pass 1: state.done is 0, so activation is purely based on what's scheduled in this run
 */

import type {
  FormInputs,
  Plan,
  DayPlan,
  StudyBlock,
  WeeklySummary,
  ActivityType,
  WeeklyActual,
  GeneratorOptions,
  StudentState,
  PlanCapacity,
} from "./types";
import {
  MAX_BLOCK_DURATION,
  PHASE_DEFINITIONS,
  THEORY_ENVELOPE_MINUTES,
} from "./rules";
import { getTodayISO, addDays, getWeekday, diffDays, getWeekStart, getNowISO } from "../utils/date";
import { calculateCapacity } from "./capacity";
import {
  selectActivityWithSmoothing,
  updateGlobalBudget,
  getCurrentUnitKey,
  WEEKLY_MINIMUM_MINUTES,
  type AllocatorContext,
  type GlobalBudget,
} from "./allocator";
import { generateExplanations } from "./explain";
import { deriveInitialState } from "./state";

function availabilityIndex(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

function activityStream(a: ActivityType): "theory" | "cases" | "programming" {
  switch (a) {
    case "STUDY_THEME":
    case "REVIEW":
    case "PODCAST":
    case "FLASHCARD":
    case "QUIZ":
      return "theory";
    case "CASE_PRACTICE":
    case "CASE_MOCK":
      return "cases";
    case "PROGRAMMING_BLOCK":
      return "programming";
  }
}

function mapActivityToBlock(
  activity: ActivityType,
  durationMinutes: number,
  unit: string | null
): Omit<StudyBlock, "notes"> {
  const base = { durationMinutes, activity, unit, notes: "" };
  switch (activity) {
    case "STUDY_THEME":
      return { ...base, selviaPhase: "P2_DEPTH", type: "new_content", format: "raw_content" };
    case "REVIEW":
      return { ...base, selviaPhase: "P3_EVAL_REVIEW", type: "review", format: "flashcards" };
    case "PODCAST":
      return { ...base, selviaPhase: "P2_DEPTH", type: "new_content", format: "audio" };
    case "FLASHCARD":
      return { ...base, selviaPhase: "P3_EVAL_REVIEW", type: "recap", format: "flashcards" };
    case "QUIZ":
      return { ...base, selviaPhase: "P3_EVAL_REVIEW", type: "quiz", format: "quiz" };
    case "CASE_PRACTICE":
      return { ...base, selviaPhase: "P4_PRACTICE", type: "practice", format: "quiz" };
    case "CASE_MOCK":
      return { ...base, selviaPhase: "P4_PRACTICE", type: "evaluation", format: "quiz" };
    case "PROGRAMMING_BLOCK":
      return { ...base, selviaPhase: "P4_PRACTICE", type: "practice", format: "raw_content", unit: "Programación" };
    default:
      return { ...base, selviaPhase: "P2_DEPTH", type: "new_content", format: "raw_content" };
  }
}

function generateBlockId(
  dateISO: string,
  index: number,
  activity: ActivityType,
  unit: string | null
): string {
  return `${dateISO}__${index}__${activity}__${unit ?? "NA"}`;
}

/**
 * Convert StudentState to GlobalBudget for allocator.
 *
 * - remaining = required - done (represents what still needs to be scheduled)
 * - studyThemeDone is initialized from state.done.studyTheme (0 in Pass 1)
 * - The allocator increments studyThemeDone as blocks are scheduled
 * - Activation/gating is based on scheduled-so-far, not historical done
 */
export function createBudgetFromState(state: StudentState): GlobalBudget {
  const unitTheoryRemaining: GlobalBudget["unitTheoryRemaining"] = {};

  // Sum up theory planned from required
  let theoryPlanned = 0;

  for (const [unitId, unitState] of Object.entries(state.units)) {
    const req = unitState.required;
    const done = unitState.done;

    // Remaining = required - done
    const studyThemeRemaining = Math.max(0, req.studyTheme - done.studyTheme);
    const reviewRemaining = Math.max(0, req.review - done.review);
    const podcastRemaining = Math.max(0, req.podcast - done.podcast);
    const flashcardRemaining = Math.max(0, req.flashcard - done.flashcard);
    const quizRemaining = Math.max(0, req.quiz - done.quiz);
    const totalRemaining = studyThemeRemaining + reviewRemaining + podcastRemaining + flashcardRemaining + quizRemaining;

    unitTheoryRemaining[unitId] = {
      studyThemeRemaining,
      studyThemeDone: done.studyTheme, // Starts from historical done (0 in Pass 1)
      reviewRemaining,
      podcastRemaining,
      flashcardRemaining,
      quizRemaining,
      totalRemaining,
      studyThemeComplete: done.studyTheme >= 240, // Based on done, not scheduled-so-far
    };

    // Theory planned is sum of all unit theory requirements
    theoryPlanned += req.studyTheme + req.review + req.podcast + req.flashcard + req.quiz;
  }

  // Global theory remaining is sum of all unit remaining
  let theoryRemaining = 0;
  for (const unit of Object.values(unitTheoryRemaining)) {
    theoryRemaining += unit.totalRemaining;
  }

  const casesPlanned = state.global.casesRequired;
  const programmingPlanned = state.global.programmingRequired;
  const casesRemaining = Math.max(0, casesPlanned - state.global.casesDone);
  const programmingRemaining = Math.max(0, programmingPlanned - state.global.programmingDone);

  return {
    theoryPlanned,
    casesPlanned,
    programmingPlanned,
    theoryRemaining,
    casesRemaining,
    programmingRemaining,
    casePracticeScheduled: 0,
    caseMockScheduled: 0,
    unitTheoryRemaining,
  };
}

/**
 * Generate plan from StudentState.
 *
 * Core generator that consumes StudentState and produces a Plan.
 * Activation/gating is based on scheduled-so-far (tracked in GlobalBudget.studyThemeDone).
 */
export function generatePlanFromState(
  inputs: FormInputs,
  state: StudentState,
  options?: GeneratorOptions
): Plan {
  const today = options?.todayISO ?? state.meta.todayISO;
  const examDate = inputs.examDate;
  const totalDays = diffDays(today, examDate);
  const capacity = calculateCapacity(inputs, { todayISO: today });
  const budget = createBudgetFromState(state);

  const days: DayPlan[] = [];
  const weeklyActuals: WeeklyActual[] = [];
  let theoryScheduled = 0;
  let casesScheduled = 0;
  let programmingScheduled = 0;

  let lastWeekCases = 0;
  let lastWeekProg = 0;
  let thisWeekTheory = 0;
  let thisWeekCases = 0;
  let thisWeekProg = 0;
  let lastWeekStart: string | null = null;
  let starvationWeeks = 0;
  let weekIndexBase = 0;
  let weeksWithFullPresence = 0;
  let totalWeeksAfterTwo = 0;

  const weeklyAvailability = new Map<string, number>();
  for (let d = 0; d < totalDays; d++) {
    const date = addDays(today, d);
    const ws = getWeekStart(date);
    const wd = getWeekday(date);
    const mins = Math.round((inputs.availabilityHoursByWeekday[availabilityIndex(wd)] ?? 0) * 60);
    weeklyAvailability.set(ws, (weeklyAvailability.get(ws) ?? 0) + mins);
  }

  const MIN = WEEKLY_MINIMUM_MINUTES;

  function missingStreamsForWeek(tTheory: number, tCases: number, tProg: number): string[] {
    const out: string[] = [];
    if (tTheory < MIN && budget.theoryRemaining > 0) out.push("THEORY");
    if (tCases < MIN && budget.casesRemaining > 0) out.push("CASES");
    if (tProg < MIN && budget.programmingRemaining > 0) out.push("PROGRAMMING");
    return out;
  }

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const date = addDays(today, dayIndex);
    const weekday = getWeekday(date);
    const idx = availabilityIndex(weekday);
    const availHours = inputs.availabilityHoursByWeekday[idx] ?? 0;
    const availableMinutes = Math.round(availHours * 60);
    const weekIndex = Math.floor(dayIndex / 7) + 1;
    const weekStart = getWeekStart(date);

    if (weekStart !== lastWeekStart && lastWeekStart !== null) {
      const miss = missingStreamsForWeek(thisWeekTheory, thisWeekCases, thisWeekProg);
      weeklyActuals.push({
        weekIndex: weekIndexBase,
        weekStart: lastWeekStart,
        theoryMinutes: thisWeekTheory,
        casesMinutes: thisWeekCases,
        programmingMinutes: thisWeekProg,
        totalMinutes: thisWeekTheory + thisWeekCases + thisWeekProg,
        missingStreams: miss,
      });
      if (weekIndexBase > 2) {
        totalWeeksAfterTwo++;
        if (miss.length === 0) weeksWithFullPresence++;
        if (budget.casesRemaining > 0 && thisWeekCases === 0) starvationWeeks++;
        if (budget.programmingRemaining > 0 && thisWeekProg === 0) starvationWeeks++;
      }
      lastWeekCases = thisWeekCases;
      lastWeekProg = thisWeekProg;
      thisWeekTheory = 0;
      thisWeekCases = 0;
      thisWeekProg = 0;
    }
    lastWeekStart = weekStart;
    weekIndexBase = weekIndex;

    if (weekIndex > capacity.effectivePlanningWeeks) {
      days.push({ date, weekday, totalHours: 0, blocks: [] });
      continue;
    }

    if (availableMinutes < 15) {
      days.push({ date, weekday, totalHours: 0, blocks: [] });
      continue;
    }

    const blocks: StudyBlock[] = [];
    let blockIndex = 0;
    let remaining = availableMinutes;
    const dayCtx: AllocatorContext = {
      lastWeekCasesMinutes: lastWeekCases,
      lastWeekProgrammingMinutes: lastWeekProg,
      thisWeekTheory,
      thisWeekCases,
      thisWeekProg,
      weekRemainingMinutes: Math.max(
        0,
        (weeklyAvailability.get(weekStart) ?? 0) - (thisWeekTheory + thisWeekCases + thisWeekProg)
      ),
      weekIndex,
      studyThemeTodayUnit: null,
      studyThemeTodayMinutes: 0,
      availableMinutesToday: availableMinutes,
    };

    function updateDayCtxWeek(): void {
      dayCtx.thisWeekTheory = thisWeekTheory;
      dayCtx.thisWeekCases = thisWeekCases;
      dayCtx.thisWeekProg = thisWeekProg;
      dayCtx.weekRemainingMinutes = Math.max(
        0,
        (weeklyAvailability.get(weekStart) ?? 0) - (thisWeekTheory + thisWeekCases + thisWeekProg)
      );
    }

    if (remaining >= 60) {
      while (remaining >= 60) {
        updateDayCtxWeek();
        const act = selectActivityWithSmoothing(budget, dayCtx);
        if (!act) break;
        const dur = Math.min(MAX_BLOCK_DURATION, remaining);
        const unit = activityStream(act) === "theory" ? getCurrentUnitKey(budget, dayCtx) : null;
        const raw = mapActivityToBlock(act, dur, unit);
        const id = generateBlockId(date, blockIndex++, act, unit);
        blocks.push({ ...raw, id, notes: `${act}${unit ? ` – ${unit}` : ""}` });
        updateGlobalBudget(budget, act, dur, unit, dayCtx);
        remaining -= dur;
        const stream = activityStream(act);
        if (stream === "theory") {
          theoryScheduled += dur;
          thisWeekTheory += dur;
          if (act === "STUDY_THEME") dayCtx.studyThemeTodayMinutes = (dayCtx.studyThemeTodayMinutes ?? 0) + dur;
        } else if (stream === "cases") {
          casesScheduled += dur;
          thisWeekCases += dur;
        } else {
          programmingScheduled += dur;
          thisWeekProg += dur;
        }
      }
      if (remaining >= 15) {
        updateDayCtxWeek();
        const act = selectActivityWithSmoothing(budget, dayCtx);
        if (act) {
          const unit = activityStream(act) === "theory" ? getCurrentUnitKey(budget, dayCtx) : null;
          const raw = mapActivityToBlock(act, remaining, unit);
          const id = generateBlockId(date, blockIndex++, act, unit);
          blocks.push({ ...raw, id, notes: `${act}${unit ? ` – ${unit}` : ""}` });
          updateGlobalBudget(budget, act, remaining, unit, dayCtx);
          const stream = activityStream(act);
          if (stream === "theory") {
            theoryScheduled += remaining;
            thisWeekTheory += remaining;
            if (act === "STUDY_THEME") dayCtx.studyThemeTodayMinutes = (dayCtx.studyThemeTodayMinutes ?? 0) + remaining;
          } else if (stream === "cases") {
            casesScheduled += remaining;
            thisWeekCases += remaining;
          } else {
            programmingScheduled += remaining;
            thisWeekProg += remaining;
          }
          remaining = 0;
        }
      }
    } else {
      updateDayCtxWeek();
      const act = selectActivityWithSmoothing(budget, dayCtx);
      if (act) {
        const unit = activityStream(act) === "theory" ? getCurrentUnitKey(budget, dayCtx) : null;
        const raw = mapActivityToBlock(act, remaining, unit);
        const id = generateBlockId(date, blockIndex++, act, unit);
        blocks.push({ ...raw, id, notes: `${act}${unit ? ` – ${unit}` : ""}` });
        updateGlobalBudget(budget, act, remaining, unit, dayCtx);
        const stream = activityStream(act);
        if (stream === "theory") {
          theoryScheduled += remaining;
          thisWeekTheory += remaining;
          if (act === "STUDY_THEME") dayCtx.studyThemeTodayMinutes = (dayCtx.studyThemeTodayMinutes ?? 0) + remaining;
        } else if (stream === "cases") {
          casesScheduled += remaining;
          thisWeekCases += remaining;
        } else {
          programmingScheduled += remaining;
          thisWeekProg += remaining;
        }
      }
    }

    const totalHours = blocks.reduce((s, b) => s + b.durationMinutes, 0) / 60;
    days.push({ date, weekday, totalHours, blocks });
  }

  if (lastWeekStart) {
    const miss = missingStreamsForWeek(thisWeekTheory, thisWeekCases, thisWeekProg);
    weeklyActuals.push({
      weekIndex: weekIndexBase,
      weekStart: lastWeekStart,
      theoryMinutes: thisWeekTheory,
      casesMinutes: thisWeekCases,
      programmingMinutes: thisWeekProg,
      totalMinutes: thisWeekTheory + thisWeekCases + thisWeekProg,
      missingStreams: miss,
    });
    if (weekIndexBase > 2) {
      totalWeeksAfterTwo++;
      if (miss.length === 0) weeksWithFullPresence++;
      if (budget.casesRemaining > 0 && thisWeekCases === 0) starvationWeeks++;
      if (budget.programmingRemaining > 0 && thisWeekProg === 0) starvationWeeks++;
    }
  }

  const totalScheduled = theoryScheduled + casesScheduled + programmingScheduled;
  const theoryRatio = totalScheduled > 0 ? theoryScheduled / totalScheduled : 0;
  const casesRatio = totalScheduled > 0 ? casesScheduled / totalScheduled : 0;
  const programmingRatio = totalScheduled > 0 ? programmingScheduled / totalScheduled : 0;

  const unitCount = capacity.unitsCount;
  const weekMap = new Map<string, WeeklySummary>();
  for (const day of days) {
    const ws = getWeekStart(day.date);
    let sum = weekMap.get(ws);
    if (!sum) {
      sum = {
        weekStartDate: ws,
        totalHours: 0,
        allocationByPhase: { P1_CONTEXT: 0, P2_DEPTH: 0, P3_EVAL_REVIEW: 0, P4_PRACTICE: 0 },
      };
      weekMap.set(ws, sum);
    }
    sum.totalHours += day.totalHours;
    for (const b of day.blocks) {
      sum.allocationByPhase[b.selviaPhase] += b.durationMinutes;
    }
  }
  const weeklySummaries = Array.from(weekMap.values());

  const plan: Plan = {
    meta: {
      generatedAt: getNowISO(),
      today,
      examDate,
      region: inputs.region,
      stage: inputs.stage,
      unitsTotal: unitCount,
    },
    phases: PHASE_DEFINITIONS,
    masteryByUnit: {},
    days,
    weeklySummaries,
    explanations: [],
    debugInfo: {
      capacity,
      theoryScheduled,
      casesScheduled,
      programmingScheduled,
      totalScheduled,
      theoryRatio,
      casesRatio,
      programmingRatio,
      weeklyActuals,
      starvationWeeks,
      weeksWithFullPresence,
      totalWeeksAfterTwo,
    },
  };
  plan.explanations = generateExplanations(plan, inputs);
  return plan;
}

/**
 * Generate plan from form inputs (backward-compatible wrapper).
 *
 * Derives initial StudentState from inputs, then calls generatePlanFromState.
 * All existing tests and callers continue to work without changes.
 */
export function generatePlan(inputs: FormInputs, options?: GeneratorOptions): Plan {
  const today = options?.todayISO ?? getTodayISO();
  const capacity = calculateCapacity(inputs, { todayISO: today });
  const state = deriveInitialState(inputs, capacity, today);
  return generatePlanFromState(inputs, state, options);
}
