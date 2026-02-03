/**
 * API v1 plan flow - engine-level tests
 * Verifies the flow used by POST /api/v1/plan
 */

import { describe, it, expect } from "vitest";
import { generatePlanFromState } from "../generator";
import { calculateCapacity } from "../capacity";
import { deriveInitialState, applyFeedbackEvents } from "../state";
import type { FormInputs, FeedbackEvent } from "../types";

const TEST_TODAY = "2026-01-01";
const TEST_EXAM = "2026-03-12"; // ~70 days

function createInputs(overrides: Partial<FormInputs> = {}): FormInputs {
  return {
    examDate: TEST_EXAM,
    availabilityHoursByWeekday: [4, 4, 4, 4, 4, 0, 0],
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
    ...overrides,
  };
}

describe("API v1 plan flow", () => {
  it("API-01: No events returns plan and initial state with meta.today === todayISO", () => {
    const inputs = createInputs();
    const today = TEST_TODAY;
    const capacity = calculateCapacity(inputs, { todayISO: today });
    const studentState = deriveInitialState(inputs, capacity, today);

    const plan = generatePlanFromState(inputs, studentState, { todayISO: today });

    expect(plan.meta.today).toBe(today);
    expect(studentState).toBeDefined();
    expect(studentState.prefs).toBeDefined();
    expect(studentState.prefs.targetMinutesByActivity).toBeDefined();
  });

  it("API-02: With QUIZ_RESULT event, state.required changes", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const baseState = deriveInitialState(inputs, capacity, TEST_TODAY);
    const beforeReview = baseState.units["Unidad 1"].required.review;

    const events: FeedbackEvent[] = [
      { type: "QUIZ_RESULT", dateISO: "2026-01-05", unit: "Unidad 1", score: 45 },
    ];
    const studentState = applyFeedbackEvents(baseState, events);

    expect(studentState.units["Unidad 1"].required.review).toBeGreaterThan(beforeReview);
  });

  it("API-03: With provided state, uses it instead of deriving", () => {
    const inputs = createInputs();
    const capacity = calculateCapacity(inputs, { todayISO: TEST_TODAY });
    const baseState = deriveInitialState(inputs, capacity, TEST_TODAY);

    const customState = JSON.parse(JSON.stringify(baseState)) as typeof baseState;
    customState.prefs.targetMinutesByActivity.STUDY_THEME = 45;

    const plan = generatePlanFromState(inputs, customState, { todayISO: TEST_TODAY });

    let firstStudyThemeDuration = 0;
    for (const day of plan.days) {
      for (const b of day.blocks) {
        if (b.activity === "STUDY_THEME") {
          firstStudyThemeDuration = b.durationMinutes;
          break;
        }
      }
      if (firstStudyThemeDuration > 0) break;
    }

    expect(firstStudyThemeDuration).toBeGreaterThan(0);
    expect(firstStudyThemeDuration).toBeLessThanOrEqual(45);
  });
});
