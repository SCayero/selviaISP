/**
 * Unit tests for Pass 1 allocator (ALLOC-01 through ALLOC-05)
 */

import { describe, it, expect } from "vitest";
import {
  createGlobalBudget,
  selectActivity,
  selectTheoryActivity,
  selectCasesActivity,
  updateGlobalBudget,
  getCurrentUnitKey,
} from "../allocator";
import { calculateCapacity } from "../capacity";
import type { FormInputs } from "../types";

function createInputs(overrides: Partial<FormInputs> = {}): FormInputs {
  return {
    examDate: "2025-03-12",
    availabilityHoursByWeekday: [4, 4, 4, 4, 4, 0, 0],
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
    ...overrides,
  };
}

describe("allocator", () => {
  it("ALLOC-01: Weeks 1–2 are theory-only (no CASES or PROGRAMMING in first 14 days)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const budget = createGlobalBudget(cap);

    for (let week = 1; week <= 2; week++) {
      const act = selectActivity(budget, week);
      expect(act).not.toBe("CASE_PRACTICE");
      expect(act).not.toBe("CASE_MOCK");
      expect(act).not.toBe("PROGRAMMING_BLOCK");
    }
  });

  it("ALLOC-02: Stream with highest remaining ratio is selected", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const budget = createGlobalBudget(cap);

    budget.theoryRemaining = 100;
    budget.casesRemaining = 5000;
    budget.programmingRemaining = 4000;

    const act = selectActivity(budget, 3);
    expect(act).toBeTruthy();
    const cr = 5000 / budget.casesPlanned;
    const pr = 4000 / budget.programmingPlanned;
    const tr = 100 / budget.theoryPlanned;
    const best = Math.max(tr, cr, pr);
    if (best === cr) expect(["CASE_PRACTICE", "CASE_MOCK"]).toContain(act);
    else if (best === pr) expect(act).toBe("PROGRAMMING_BLOCK");
    else expect(["STUDY_THEME", "REVIEW", "PODCAST", "FLASHCARD", "QUIZ"]).toContain(act);
  });

  it("ALLOC-03: Guardrail prefers CASES when last week had 0 cases and remaining > 0", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const budget = createGlobalBudget(cap);

    budget.theoryRemaining = 1000;
    budget.casesRemaining = 1000;
    budget.programmingRemaining = 1000;
    const act = selectActivity(budget, 3, {
      lastWeekCasesMinutes: 0,
      lastWeekProgrammingMinutes: 100,
    });
    expect(act).toBeTruthy();
    expect(["CASE_PRACTICE", "CASE_MOCK"]).toContain(act);
  });

  it("ALLOC-04: Theory activity priority (STUDY_THEME before REVIEW before PODCAST etc.)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const budget = createGlobalBudget(cap);

    const act = selectTheoryActivity(budget);
    expect(act).toBe("STUDY_THEME");
  });

  it("ALLOC-05: STUDY_THEME completion tracking (studyThemeComplete after 240m)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const budget = createGlobalBudget(cap);

    const k = getCurrentUnitKey(budget);
    expect(k).toBe("Unidad 1");
    const u = budget.unitTheoryRemaining["Unidad 1"];
    expect(u.studyThemeComplete).toBe(false);

    updateGlobalBudget(budget, "STUDY_THEME", 240);
    const u2 = budget.unitTheoryRemaining["Unidad 1"];
    expect(u2.studyThemeComplete).toBe(true);
    expect(u2.studyThemeRemaining).toBe(0);
  });
});
