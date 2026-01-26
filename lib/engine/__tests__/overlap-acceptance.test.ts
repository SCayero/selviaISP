/**
 * Overlap rules V1 acceptance tests (AT-01 through AT-08).
 * Uses pinned todayISO and deterministic inputs.
 */

import { describe, it, expect } from "vitest";
import { generatePlan } from "../generator";
import type { FormInputs, DayPlan, StudyBlock, ActivityType } from "../types";

const TEST_TODAY = "2026-01-01";
const TEST_EXAM = "2026-03-12";

function availabilityIndex(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

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

function getActivity(b: StudyBlock): ActivityType | undefined {
  return b.activity;
}

function getStudyThemeUnitsForDay(day: DayPlan): string[] {
  const units = new Set<string>();
  for (const b of day.blocks) {
    const a = getActivity(b);
    if (a === "STUDY_THEME" && b.unit) units.add(b.unit);
  }
  return Array.from(units);
}

function getStudyThemeMinutesForDay(day: DayPlan): number {
  let sum = 0;
  for (const b of day.blocks) {
    if (getActivity(b) === "STUDY_THEME") sum += b.durationMinutes;
  }
  return sum;
}

function getCumulativeStudyThemeByUnit(
  days: DayPlan[],
  upToIndex: number
): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i <= upToIndex && i < days.length; i++) {
    const day = days[i];
    for (const b of day.blocks) {
      if (getActivity(b) === "STUDY_THEME" && b.unit) {
        m.set(b.unit, (m.get(b.unit) ?? 0) + b.durationMinutes);
      }
    }
  }
  return m;
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

function getDistinctUnitsTouched(day: DayPlan): number {
  const units = new Set<string>();
  for (const b of day.blocks) {
    if (b.unit) units.add(b.unit);
  }
  return units.size;
}

function getDistinctStreamsTouched(day: DayPlan): number {
  const streams = new Set<"theory" | "cases" | "programming">();
  for (const b of day.blocks) {
    const a = getActivity(b);
    if (a) streams.add(activityStream(a));
  }
  return streams.size;
}

function getAvailableMinutesForDay(day: DayPlan, inputs: FormInputs): number {
  const idx = availabilityIndex(day.weekday);
  const hours = inputs.availabilityHoursByWeekday[idx] ?? 0;
  return Math.round(hours * 60);
}

function dayMinutes(day: DayPlan): number {
  return day.blocks.reduce((s, b) => s + b.durationMinutes, 0);
}

function cumulativeStudyThemeMinutesUpTo(
  days: DayPlan[],
  date: string,
  unit: string
): number {
  let sum = 0;
  for (const d of days) {
    if (d.date > date) break;
    for (const b of d.blocks) {
      if (getActivity(b) === "STUDY_THEME" && b.unit === unit) {
        sum += b.durationMinutes;
      }
    }
  }
  return sum;
}

const ACTIVATION_THRESHOLD = 120;

function isActivated(days: DayPlan[], date: string, unit: string): boolean {
  return cumulativeStudyThemeMinutesUpTo(days, date, unit) >= ACTIVATION_THRESHOLD;
}

function isCompletedStudyTheme(days: DayPlan[], date: string, unit: string): boolean {
  return cumulativeStudyThemeMinutesUpTo(days, date, unit) >= 240;
}

function distinctSyllabusUnitsTouched(day: DayPlan): string[] {
  const units = new Set<string>();
  for (const b of day.blocks) {
    if (b.unit && b.unit !== "Programación") units.add(b.unit);
  }
  return Array.from(units);
}

describe("Overlap rules V1 acceptance tests", () => {
  const INPUTS = createInputs();

  it("AT-01: One study_theme unit per day", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      const studyThemeUnits = getStudyThemeUnitsForDay(day);
      expect(studyThemeUnits.length).toBeLessThanOrEqual(1);
    }
  });

  it("AT-02: Long-day cap", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      const availableMinutes = getAvailableMinutesForDay(day, INPUTS);
      if (availableMinutes < 240) continue;
      const studyThemeMinutes = getStudyThemeMinutesForDay(day);
      const cap = Math.floor(availableMinutes * 0.5);
      expect(studyThemeMinutes).toBeLessThanOrEqual(cap);
    }
  });

  it("AT-03: Short-day allowance", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 4, 3, 4, 4, 0, 0],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      const availableMinutes = getAvailableMinutesForDay(day, inputs);
      if (availableMinutes !== 180) continue;
      const studyThemeMinutes = getStudyThemeMinutesForDay(day);
      expect(studyThemeMinutes).toBeLessThanOrEqual(120);
    }
  });

  it("AT-04: Secondary theory allowed after start", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const firstWeekDays = plan.days.filter((_, i) => i < 7);
    let foundSecondaryBefore240 = false;
    const cumulative = new Map<string, number>();

    for (const day of firstWeekDays) {
      for (const b of day.blocks) {
        const a = getActivity(b);
        if (!a || !b.unit) continue;
        if (a === "STUDY_THEME") {
          cumulative.set(b.unit, (cumulative.get(b.unit) ?? 0) + b.durationMinutes);
        }
        if (["PODCAST", "FLASHCARD", "QUIZ"].includes(a)) {
          const studyThemeSoFar = cumulative.get(b.unit) ?? 0;
          if (studyThemeSoFar < 240) foundSecondaryBefore240 = true;
        }
      }
    }
    expect(foundSecondaryBefore240).toBe(true);
  });

  it("AT-05: Review gating", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const cumulative = new Map<string, number>();

    for (const day of plan.days) {
      for (const b of day.blocks) {
        const a = getActivity(b);
        if (!a || !b.unit) continue;
        if (a === "STUDY_THEME") {
          cumulative.set(b.unit, (cumulative.get(b.unit) ?? 0) + b.durationMinutes);
        }
        if (a === "REVIEW") {
          const studyThemeSoFar = cumulative.get(b.unit) ?? 0;
          expect(studyThemeSoFar).toBeGreaterThanOrEqual(240);
        }
      }
    }
  });

  it("AT-06: Variety outcome (soft)", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const scheduled = plan.days.filter(
      (d) => d.blocks.length > 0 && getAvailableMinutesForDay(d, INPUTS) >= 180
    );
    const first10 = scheduled.slice(0, 10);
    let varietyDays = 0;
    for (const day of first10) {
      const units = getDistinctUnitsTouched(day);
      const streams = getDistinctStreamsTouched(day);
      if (units >= 2 || streams >= 2) varietyDays++;
    }
    expect(varietyDays).toBeGreaterThanOrEqual(5);
  });

  it("AT-07: Unit 2 starts early", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const scheduled = plan.days.filter((d) => d.blocks.length > 0);
    const first5 = scheduled.slice(0, 5);
    let unit2HasStudyThemeInFirst5 = false;
    let unit1Cumulative = 0;
    let unit2FirstStudyThemeAfterUnit1_120 = true;

    for (const day of first5) {
      for (const b of day.blocks) {
        const a = getActivity(b);
        if (!a || !b.unit) continue;
        if (a === "STUDY_THEME") {
          if (b.unit === "Unidad 1") {
            unit1Cumulative += b.durationMinutes;
          }
          if (b.unit === "Unidad 2") {
            unit2HasStudyThemeInFirst5 = true;
            if (unit1Cumulative < 120) unit2FirstStudyThemeAfterUnit1_120 = false;
          }
        }
      }
    }
    expect(unit1Cumulative).toBeGreaterThanOrEqual(120);
    expect(unit2HasStudyThemeInFirst5).toBe(true);
    expect(unit2FirstStudyThemeAfterUnit1_120).toBe(true);
  });

  it("AT-08: Limit single-unit-focus days", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const scheduled = plan.days.filter((d) => {
      const total = d.blocks.reduce((s, b) => s + b.durationMinutes, 0);
      return total > 0;
    });
    const first14 = scheduled.slice(0, 14);
    let singleFocusCount = 0;
    for (const day of first14) {
      const total = day.blocks.reduce((s, b) => s + b.durationMinutes, 0);
      const units = getDistinctUnitsTouched(day);
      if (units === 1 && total >= 180) singleFocusCount++;
    }
    expect(singleFocusCount).toBeLessThanOrEqual(6);
  });

  const SECONDARY_ACTIVITIES = ["PODCAST", "FLASHCARD", "QUIZ", "REVIEW"] as const;

  it("AT-A1: No secondary theory on unactivated units", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      for (const b of day.blocks) {
        const a = getActivity(b);
        const unit = b.unit;
        if (!unit || !SECONDARY_ACTIVITIES.includes(a as (typeof SECONDARY_ACTIVITIES)[number])) continue;
        if (unit === "Programación") continue;
        expect(isActivated(plan.days, day.date, unit)).toBe(true);
      }
    }
  });

  it("AT-A2: Units with 0 STUDY_THEME never appear in secondary activities", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    const studyThemeUnits = new Set<string>();
    for (const day of plan.days) {
      for (const b of day.blocks) {
        if (getActivity(b) === "STUDY_THEME" && b.unit) studyThemeUnits.add(b.unit);
      }
    }
    for (const day of plan.days) {
      for (const b of day.blocks) {
        const a = getActivity(b);
        const unit = b.unit;
        if (!unit || !SECONDARY_ACTIVITIES.includes(a as (typeof SECONDARY_ACTIVITIES)[number])) continue;
        expect(studyThemeUnits.has(unit)).toBe(true);
      }
    }
  });

  it("AT-B2-180: STUDY_THEME cap for 3h (180m) days", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 4, 3, 4, 4, 0, 0],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      const availableMinutes = getAvailableMinutesForDay(day, inputs);
      if (availableMinutes !== 180) continue;
      const studyThemeMinutes = getStudyThemeMinutesForDay(day);
      expect(studyThemeMinutes).toBeLessThanOrEqual(120);
    }
  });

  it("AT-B2-120: STUDY_THEME cap for 2h (120m) days", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 4, 4, 2, 4, 0, 0],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      const availableMinutes = getAvailableMinutesForDay(day, inputs);
      if (availableMinutes !== 120) continue;
      const studyThemeMinutes = getStudyThemeMinutesForDay(day);
      expect(studyThemeMinutes).toBeLessThanOrEqual(120);
    }
  });

  it("AT-C1: Max 3 syllabus units touched per day", () => {
    const plan = generatePlan(INPUTS, { todayISO: TEST_TODAY });
    for (const day of plan.days) {
      if (dayMinutes(day) === 0) continue;
      const units = distinctSyllabusUnitsTouched(day);
      expect(units.length).toBeLessThanOrEqual(3);
    }
  });
});
