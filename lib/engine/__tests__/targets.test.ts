/**
 * Unit tests for target calculation
 */

import { describe, it, expect } from "vitest";
import { calculateTargets, TIME_CONDITION_THRESHOLD } from "../targets";
import type { FormInputs } from "../types";

const TEST_TODAY = "2025-01-01";

function createTestInputs(overrides: Partial<FormInputs> = {}): FormInputs {
  return {
    examDate: "2025-02-15", // 45 days from test today
    availabilityHoursByWeekday: [2, 2, 2, 2, 2, 3, 1], // 14h/week
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
    ...overrides,
  };
}

describe("calculateTargets", () => {
  it("calculates hoursAvailable correctly", () => {
    const inputs = createTestInputs();
    const targets = calculateTargets(inputs, 45);

    // 45 days = ~6.4 weeks, 14h/week = ~90 hours
    expect(targets.hoursAvailable).toBeCloseTo(90, 0);
  });

  it("sets timeCondition to 'comfortable' when >= 260h", () => {
    const inputs = createTestInputs({
      availabilityHoursByWeekday: [6, 6, 6, 6, 6, 6, 6], // 42h/week
      examDate: "2025-02-20", // 50 days = ~7 weeks = ~294 hours
    });
    const targets = calculateTargets(inputs, 50);

    expect(targets.hoursAvailable).toBeGreaterThanOrEqual(TIME_CONDITION_THRESHOLD);
    expect(targets.timeCondition).toBe("comfortable");
  });

  it("sets timeCondition to 'tight' when < 260h", () => {
    const inputs = createTestInputs({
      availabilityHoursByWeekday: [2, 2, 2, 2, 2, 2, 2], // 14h/week
      examDate: "2025-02-01", // 31 days = ~4.4 weeks = ~62 hours
    });
    const targets = calculateTargets(inputs, 31);

    expect(targets.hoursAvailable).toBeLessThan(TIME_CONDITION_THRESHOLD);
    expect(targets.timeCondition).toBe("tight");
  });

  it("sets timeWarning when available < 90% of required", () => {
    const inputs = createTestInputs({
      availabilityHoursByWeekday: [1, 1, 1, 1, 1, 1, 1], // 7h/week (very low)
      examDate: "2025-01-15", // 14 days = 2 weeks = ~14 hours
    });
    const targets = calculateTargets(inputs, 14);

    expect(targets.timeWarning).toBe(true);
    expect(targets.hoursAvailable).toBeLessThan(targets.totalRequiredHours * 0.9);
  });

  it("calculates casesTarget based on themesCount and studentType", () => {
    const newStudent = createTestInputs({
      themesCount: 20,
      studentType: "new",
    });
    const repeatStudent = createTestInputs({
      themesCount: 20,
      studentType: "repeat",
    });

    const newTargets = calculateTargets(newStudent, 45);
    const repeatTargets = calculateTargets(repeatStudent, 45);

    // New students: 1 case per theme
    expect(newTargets.casesTarget).toBe(20);
    // Repeat students: 2 cases per theme
    expect(repeatTargets.casesTarget).toBe(40);
  });

  it("respects planProgramming flag", () => {
    const withProgramming = createTestInputs({ planProgramming: true });
    const withoutProgramming = createTestInputs({ planProgramming: false });

    const targetsWith = calculateTargets(withProgramming, 45);
    const targetsWithout = calculateTargets(withoutProgramming, 45);

    expect(targetsWith.programmingHoursTarget).toBeGreaterThan(0);
    expect(targetsWithout.programmingHoursTarget).toBe(0);
  });

  it("scales simulation counts with timeCondition", () => {
    const comfortable = createTestInputs({
      availabilityHoursByWeekday: [6, 6, 6, 6, 6, 6, 6],
      examDate: "2025-02-20", // ~294 hours
    });
    const tight = createTestInputs({
      availabilityHoursByWeekday: [2, 2, 2, 2, 2, 2, 2],
      examDate: "2025-02-01", // ~62 hours
    });

    const comfortableTargets = calculateTargets(comfortable, 50);
    const tightTargets = calculateTargets(tight, 31);

    // Comfortable should have more simulations
    expect(comfortableTargets.simTheoryCount).toBeGreaterThan(tightTargets.simTheoryCount);
    expect(comfortableTargets.simCasesCount).toBeGreaterThan(tightTargets.simCasesCount);
  });

  it("calculates additionalPool as surplus hours", () => {
    const inputs = createTestInputs({
      availabilityHoursByWeekday: [8, 8, 8, 8, 8, 8, 8], // 56h/week (plenty of time)
      examDate: "2025-03-01", // ~60 days
    });
    const targets = calculateTargets(inputs, 60);

    expect(targets.additionalPool).toBeGreaterThanOrEqual(0);
    expect(targets.additionalPool).toBe(
      Math.max(0, targets.hoursAvailable - targets.totalRequiredHours)
    );
  });

  it("uses default themesCount of 25 when not specified", () => {
    const inputs = createTestInputs(); // themesCount not specified
    const targets = calculateTargets(inputs, 45);

    // With 25 themes and studentType inferred from presentedBefore=false (new)
    expect(targets.casesTarget).toBe(25); // 25 themes * 1 case/theme for new students
  });

  it("infers studentType from presentedBefore", () => {
    const presented = createTestInputs({ presentedBefore: true, themesCount: 20 });
    const notPresented = createTestInputs({ presentedBefore: false, themesCount: 20 });

    const presentedTargets = calculateTargets(presented, 45);
    const notPresentedTargets = calculateTargets(notPresented, 45);

    // presentedBefore=true should infer studentType="repeat" (2 cases per theme)
    expect(presentedTargets.casesTarget).toBe(40);
    // presentedBefore=false should infer studentType="new" (1 case per theme)
    expect(notPresentedTargets.casesTarget).toBe(20);
  });
});
