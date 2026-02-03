/**
 * Replanning tests for feedback-driven architecture (RP-01 through RP-05).
 * Tests StudentState derivation, feedback event application, and replanning behavior.
 */

import { describe, it, expect } from "vitest";
import { generatePlan, generatePlanFromState, createBudgetFromState } from "../generator";
import { calculateCapacity } from "../capacity";
import {
  deriveInitialState,
  applyFeedbackEvents,
  QUIZ_FAIL_THRESHOLD,
  REVIEW_BOOST_MINUTES,
  ACTIVITY_TARGET_DEFAULTS,
  ACTIVITY_BOUNDS,
  SESSION_FEEDBACK_STEP,
} from "../state";
import type { FormInputs, FeedbackEvent } from "../types";

const TEST_TODAY = "2026-01-01";
const TEST_EXAM = "2026-03-12"; // ~70 days

function createInputs(overrides: Partial<FormInputs> = {}): FormInputs {
  return {
    examDate: TEST_EXAM,
    availabilityHoursByWeekday: [4, 4, 4, 4, 4, 0, 0], // Mon-Sun
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
    ...overrides,
  };
}

describe("StudentState derivation", () => {
  it("RP-05: deriveInitialState produces correct baseline", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);

    // Check meta
    expect(state.meta.todayISO).toBe(TEST_TODAY);
    expect(state.meta.examDate).toBe(TEST_EXAM);
    expect(state.meta.version).toBe(1);

    // Check unit count
    const unitCount = Object.keys(state.units).length;
    expect(unitCount).toBe(capacity.unitsCount);

    // Check unit required matches constants
    const unit1 = state.units["Unidad 1"];
    expect(unit1).toBeDefined();
    expect(unit1.required.studyTheme).toBe(240);
    expect(unit1.required.review).toBe(60);
    expect(unit1.required.podcast).toBe(60);
    expect(unit1.required.flashcard).toBe(60);
    expect(unit1.required.quiz).toBe(90);

    // Check done is 0 (Pass 1)
    expect(unit1.done.studyTheme).toBe(0);
    expect(unit1.done.review).toBe(0);
    expect(unit1.done.podcast).toBe(0);
    expect(unit1.done.flashcard).toBe(0);
    expect(unit1.done.quiz).toBe(0);

    // Check global matches capacity
    expect(state.global.casesRequired).toBe(capacity.casesPlanned);
    expect(state.global.programmingRequired).toBe(capacity.programmingPlanned);
    expect(state.global.casesDone).toBe(0);
    expect(state.global.programmingDone).toBe(0);

    // Check prefs initialized
    expect(state.prefs).toBeDefined();
    expect(state.prefs.targetMinutesByActivity).toBeDefined();
    expect(state.prefs.targetMinutesByActivity.STUDY_THEME).toBe(ACTIVITY_TARGET_DEFAULTS.STUDY_THEME);

    // Check slack is computed correctly
    // effectiveCapacityFuture should equal capacity.availableEffectiveMinutes (excludes final 2 weeks)
    expect(state.slack.effectiveCapacityFuture).toBe(capacity.availableEffectiveMinutes);
    expect(state.slack.slackMinutes).toBe(
      state.slack.effectiveCapacityFuture - state.slack.requiredMinutesFuture
    );
    expect(state.slack.slackRatio).toBeCloseTo(
      state.slack.slackMinutes / state.slack.effectiveCapacityFuture,
      6
    );
  });

  it("createBudgetFromState produces correct GlobalBudget", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);
    const budget = createBudgetFromState(state);

    // Check unit budget
    const unit1Budget = budget.unitTheoryRemaining["Unidad 1"];
    expect(unit1Budget).toBeDefined();
    expect(unit1Budget.studyThemeRemaining).toBe(240); // required - done = 240 - 0
    expect(unit1Budget.studyThemeDone).toBe(0); // starts from state.done
    expect(unit1Budget.reviewRemaining).toBe(60);
    expect(unit1Budget.podcastRemaining).toBe(60);
    expect(unit1Budget.flashcardRemaining).toBe(60);
    expect(unit1Budget.quizRemaining).toBe(90);

    // Check global
    expect(budget.casesRemaining).toBe(state.global.casesRequired);
    expect(budget.programmingRemaining).toBe(state.global.programmingRequired);
  });
});

describe("Replanning", () => {
  it("RP-01: Determinism - same inputs+state => same plan", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);

    const plan1 = generatePlanFromState(inputs, state, { todayISO: TEST_TODAY });
    const plan2 = generatePlanFromState(inputs, state, { todayISO: TEST_TODAY });

    // Same number of days
    expect(plan1.days.length).toBe(plan2.days.length);

    // Same total scheduled
    expect(plan1.debugInfo?.totalScheduled).toBe(plan2.debugInfo?.totalScheduled);
    expect(plan1.debugInfo?.theoryScheduled).toBe(plan2.debugInfo?.theoryScheduled);
    expect(plan1.debugInfo?.casesScheduled).toBe(plan2.debugInfo?.casesScheduled);
    expect(plan1.debugInfo?.programmingScheduled).toBe(plan2.debugInfo?.programmingScheduled);

    // Same blocks per day
    for (let i = 0; i < plan1.days.length; i++) {
      expect(plan1.days[i].blocks.length).toBe(plan2.days[i].blocks.length);
      for (let j = 0; j < plan1.days[i].blocks.length; j++) {
        expect(plan1.days[i].blocks[j].activity).toBe(plan2.days[i].blocks[j].activity);
        expect(plan1.days[i].blocks[j].unit).toBe(plan2.days[i].blocks[j].unit);
        expect(plan1.days[i].blocks[j].durationMinutes).toBe(plan2.days[i].blocks[j].durationMinutes);
      }
    }
  });

  it("RP-02: No scheduling before today", () => {
    const inputs = createInputs();
    // Set today to day 5 of the plan period
    const laterToday = "2026-01-06"; // 5 days after 2026-01-01
    const capacity = calculateCapacity(inputs, { todayISO: laterToday });
    const state = deriveInitialState(inputs, capacity, laterToday);

    const plan = generatePlanFromState(inputs, state, { todayISO: laterToday });

    // All days should be >= todayISO
    for (const day of plan.days) {
      expect(day.date >= laterToday).toBe(true);
    }

    // First day should be todayISO
    expect(plan.days[0].date).toBe(laterToday);
  });

  it("RP-03: Slack ratio updates when feedback increases required", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const baselineState = deriveInitialState(inputs, capacity, TEST_TODAY);

    // Apply a failing quiz result
    const events: FeedbackEvent[] = [
      { type: "QUIZ_RESULT", dateISO: "2026-01-05", unit: "Unidad 1", score: 45 },
    ];
    const updatedState = applyFeedbackEvents(baselineState, events);

    // Required should have increased
    expect(updatedState.units["Unidad 1"].required.review).toBe(
      baselineState.units["Unidad 1"].required.review + REVIEW_BOOST_MINUTES
    );

    // Slack should have decreased (more required = less slack)
    expect(updatedState.slack.slackMinutes).toBeLessThan(baselineState.slack.slackMinutes);
    expect(updatedState.slack.requiredMinutesFuture).toBeGreaterThan(
      baselineState.slack.requiredMinutesFuture
    );
  });

  it("RP-04: Low quiz result adds REVIEW minutes for that unit", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });

    // Baseline plan (no feedback)
    const baselineState = deriveInitialState(inputs, capacity, TEST_TODAY);
    const baselinePlan = generatePlanFromState(inputs, baselineState, { todayISO: TEST_TODAY });

    // Apply failing quiz result for Unit 1
    const events: FeedbackEvent[] = [
      { type: "QUIZ_RESULT", dateISO: "2026-01-05", unit: "Unidad 1", score: 45 },
    ];
    const updatedState = applyFeedbackEvents(baselineState, events);
    const replan = generatePlanFromState(inputs, updatedState, { todayISO: TEST_TODAY });

    // Count total REVIEW minutes for Unit 1 in each plan
    function countReviewMinutes(plan: typeof baselinePlan, unit: string): number {
      let total = 0;
      for (const day of plan.days) {
        for (const block of day.blocks) {
          if (block.activity === "REVIEW" && block.unit === unit) {
            total += block.durationMinutes;
          }
        }
      }
      return total;
    }

    const baselineReview = countReviewMinutes(baselinePlan, "Unidad 1");
    const replanReview = countReviewMinutes(replan, "Unidad 1");

    // Replanned should have more REVIEW minutes for Unit 1 than baseline
    // (baseline requires 60m, after feedback requires 90m)
    expect(replanReview).toBeGreaterThan(baselineReview);
  });

  it("RP-04b: Quiz result above threshold does not add extra REVIEW", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const baselineState = deriveInitialState(inputs, capacity, TEST_TODAY);

    // Apply passing quiz result (score >= 60)
    const events: FeedbackEvent[] = [
      { type: "QUIZ_RESULT", dateISO: "2026-01-05", unit: "Unidad 1", score: 75 },
    ];
    const updatedState = applyFeedbackEvents(baselineState, events);

    // Required should NOT have changed
    expect(updatedState.units["Unidad 1"].required.review).toBe(
      baselineState.units["Unidad 1"].required.review
    );

    // Slack should be the same
    expect(updatedState.slack.slackMinutes).toBe(baselineState.slack.slackMinutes);
  });

  it("RP-06: BLOCK_COMPLETED updates state.done correctly", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);

    const events: FeedbackEvent[] = [
      {
        type: "BLOCK_COMPLETED",
        dateISO: "2026-01-01",
        blockId: "test-block-1",
        activity: "STUDY_THEME",
        unit: "Unidad 1",
        completedMinutes: 120,
      },
    ];
    const updated = applyFeedbackEvents(state, events);

    expect(updated.units["Unidad 1"].done.studyTheme).toBe(120);
  });

  it("RP-07: Replan reflects completion (remaining work decreases)", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const baselineState = deriveInitialState(inputs, capacity, TEST_TODAY);
    const baselinePlan = generatePlanFromState(inputs, baselineState, { todayISO: TEST_TODAY });

    const events: FeedbackEvent[] = [
      {
        type: "BLOCK_COMPLETED",
        dateISO: "2026-01-01",
        blockId: "test-block-1",
        activity: "STUDY_THEME",
        unit: "Unidad 1",
        completedMinutes: 120,
      },
    ];
    const updatedState = applyFeedbackEvents(baselineState, events);
    const replan = generatePlanFromState(inputs, updatedState, { todayISO: TEST_TODAY });

    function countStudyThemeMinutes(plan: typeof baselinePlan, unit: string): number {
      let total = 0;
      for (const day of plan.days) {
        for (const block of day.blocks) {
          if (block.activity === "STUDY_THEME" && block.unit === unit) {
            total += block.durationMinutes;
          }
        }
      }
      return total;
    }

    const baselineStudy = countStudyThemeMinutes(baselinePlan, "Unidad 1");
    const replanStudy = countStudyThemeMinutes(replan, "Unidad 1");

    expect(replanStudy).toBeLessThanOrEqual(baselineStudy);
    expect(baselineStudy).toBeGreaterThan(0);
    expect(replanStudy).toBeLessThan(baselineStudy);
  });

  it("RP-08: Block ids deterministic", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);

    const plan1 = generatePlanFromState(inputs, state, { todayISO: TEST_TODAY });
    const plan2 = generatePlanFromState(inputs, state, { todayISO: TEST_TODAY });

    expect(plan1.days.length).toBe(plan2.days.length);
    for (let i = 0; i < plan1.days.length; i++) {
      const b1 = plan1.days[i].blocks;
      const b2 = plan2.days[i].blocks;
      expect(b1.length).toBe(b2.length);
      for (let j = 0; j < b1.length; j++) {
        expect(b1[j].id).toBeDefined();
        expect(b1[j].id).toBe(b2[j].id);
      }
    }
  });
});

describe("SESSION_FEEDBACK", () => {
  it("SF-01: too_much decreases target, more increases, ok no-op", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const base = deriveInitialState(inputs, capacity, TEST_TODAY);
    const initial = base.prefs.targetMinutesByActivity.STUDY_THEME;

    const afterTooMuch = applyFeedbackEvents(base, [
      { type: "SESSION_FEEDBACK", dateISO: TEST_TODAY, blockId: "x", activity: "STUDY_THEME", feel: "too_much" },
    ]);
    expect(afterTooMuch.prefs.targetMinutesByActivity.STUDY_THEME).toBe(initial - SESSION_FEEDBACK_STEP);

    const afterMore = applyFeedbackEvents(base, [
      { type: "SESSION_FEEDBACK", dateISO: TEST_TODAY, blockId: "x", activity: "STUDY_THEME", feel: "more" },
    ]);
    expect(afterMore.prefs.targetMinutesByActivity.STUDY_THEME).toBe(initial + SESSION_FEEDBACK_STEP);

    const afterOk = applyFeedbackEvents(base, [
      { type: "SESSION_FEEDBACK", dateISO: TEST_TODAY, blockId: "x", activity: "STUDY_THEME", feel: "ok" },
    ]);
    expect(afterOk.prefs.targetMinutesByActivity.STUDY_THEME).toBe(initial);
  });

  it("SF-02: only same activity changes", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const base = deriveInitialState(inputs, capacity, TEST_TODAY);

    const updated = applyFeedbackEvents(base, [
      { type: "SESSION_FEEDBACK", dateISO: TEST_TODAY, blockId: "x", activity: "QUIZ", feel: "more" },
    ]);

    expect(updated.prefs.targetMinutesByActivity.QUIZ).toBe(
      base.prefs.targetMinutesByActivity.QUIZ + SESSION_FEEDBACK_STEP
    );
    expect(updated.prefs.targetMinutesByActivity.STUDY_THEME).toBe(base.prefs.targetMinutesByActivity.STUDY_THEME);
    expect(updated.prefs.targetMinutesByActivity.REVIEW).toBe(base.prefs.targetMinutesByActivity.REVIEW);
    expect(updated.prefs.targetMinutesByActivity.PROGRAMMING_BLOCK).toBe(
      base.prefs.targetMinutesByActivity.PROGRAMMING_BLOCK
    );
  });

  it("SF-03: replanning shifts future block durations in expected direction", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const base = deriveInitialState(inputs, capacity, TEST_TODAY);
    const baselinePlan = generatePlanFromState(inputs, base, { todayISO: TEST_TODAY });

    const shorter = applyFeedbackEvents(base, [
      { type: "SESSION_FEEDBACK", dateISO: TEST_TODAY, blockId: "x", activity: "STUDY_THEME", feel: "too_much" },
    ]);
    const planShorter = generatePlanFromState(inputs, shorter, { todayISO: TEST_TODAY });

    function maxStudyThemeBlockMinutes(plan: typeof baselinePlan): number {
      let max = 0;
      for (const day of plan.days) {
        for (const b of day.blocks) {
          if (b.activity === "STUDY_THEME") max = Math.max(max, b.durationMinutes);
        }
      }
      return max;
    }

    const baseMax = maxStudyThemeBlockMinutes(baselinePlan);
    const shorterMax = maxStudyThemeBlockMinutes(planShorter);
    expect(shorterMax).toBeLessThanOrEqual(baseMax);
    expect(base.prefs.targetMinutesByActivity.STUDY_THEME).toBeGreaterThan(
      shorter.prefs.targetMinutesByActivity.STUDY_THEME
    );
  });

  it("SF-04: no scheduling before today invariant preserved", () => {
    const inputs = createInputs();
    const laterToday = "2026-01-06";
    const capacity = calculateCapacity(inputs, { todayISO: laterToday });
    const state = deriveInitialState(inputs, capacity, laterToday);
    const withFeedback = applyFeedbackEvents(state, [
      { type: "SESSION_FEEDBACK", dateISO: laterToday, blockId: "x", activity: "STUDY_THEME", feel: "more" },
    ]);

    const plan = generatePlanFromState(inputs, withFeedback, { todayISO: laterToday });
    for (const day of plan.days) {
      expect(day.date >= laterToday).toBe(true);
    }
    expect(plan.days[0].date).toBe(laterToday);
  });

  it("SF-05: bounds enforced", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const base = deriveInitialState(inputs, capacity, TEST_TODAY);
    const bounds = ACTIVITY_BOUNDS.STUDY_THEME;

    const manyTooMuch: FeedbackEvent[] = Array.from({ length: 20 }, () => ({
      type: "SESSION_FEEDBACK",
      dateISO: TEST_TODAY,
      blockId: "x",
      activity: "STUDY_THEME" as const,
      feel: "too_much" as const,
    }));
    const afterMin = applyFeedbackEvents(base, manyTooMuch);
    expect(afterMin.prefs.targetMinutesByActivity.STUDY_THEME).toBe(bounds.min);

    const manyMore: FeedbackEvent[] = Array.from({ length: 20 }, () => ({
      type: "SESSION_FEEDBACK",
      dateISO: TEST_TODAY,
      blockId: "x",
      activity: "STUDY_THEME" as const,
      feel: "more" as const,
    }));
    const afterMax = applyFeedbackEvents(base, manyMore);
    expect(afterMax.prefs.targetMinutesByActivity.STUDY_THEME).toBe(bounds.max);
  });
});

describe("Backward compatibility", () => {
  it("generatePlan wrapper produces same results as direct state flow", () => {
    const inputs = createInputs();

    // Using wrapper
    const planFromWrapper = generatePlan(inputs, { todayISO: TEST_TODAY });

    // Using explicit state flow
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const state = deriveInitialState(inputs, capacity, TEST_TODAY);
    const planFromState = generatePlanFromState(inputs, state, { todayISO: TEST_TODAY });

    // Should produce identical results
    expect(planFromWrapper.days.length).toBe(planFromState.days.length);
    expect(planFromWrapper.debugInfo?.totalScheduled).toBe(planFromState.debugInfo?.totalScheduled);

    // Check blocks match
    for (let i = 0; i < planFromWrapper.days.length; i++) {
      expect(planFromWrapper.days[i].blocks.length).toBe(planFromState.days[i].blocks.length);
    }
  });
});
