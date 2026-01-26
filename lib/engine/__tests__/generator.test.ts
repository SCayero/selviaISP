/**
 * Integration tests for Pass 1 generator (GEN-01 through GEN-07, EDGE-01 through EDGE-04)
 */

import { describe, it, expect } from "vitest";
import { generatePlan } from "../generator";
import type { FormInputs } from "../types";

const TEST_TODAY = "2025-01-01";

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

function streamMinutes(plan: ReturnType<typeof generatePlan>) {
  let theory = 0;
  let cases = 0;
  let programming = 0;
  plan.days.forEach((day) => {
    day.blocks.forEach((b) => {
      const a = b.activity;
      if (!a) return;
      if (["STUDY_THEME", "REVIEW", "PODCAST", "FLASHCARD", "QUIZ"].includes(a)) theory += b.durationMinutes;
      else if (["CASE_PRACTICE", "CASE_MOCK"].includes(a)) cases += b.durationMinutes;
      else if (a === "PROGRAMMING_BLOCK") programming += b.durationMinutes;
    });
  });
  return { theory, cases, programming };
}

describe("generatePlan", () => {
  it("GEN-01: Overall split converges to 50/30/20 within ±5pp", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 4, 4, 4, 4, 4, 4],
      examDate: "2025-03-15",
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const { theory, cases, programming } = streamMinutes(plan);
    const total = theory + cases + programming;
    if (total === 0) return;
    const t = (theory / total) * 100;
    const c = (cases / total) * 100;
    const p = (programming / total) * 100;
    expect(t).toBeGreaterThanOrEqual(45);
    expect(t).toBeLessThanOrEqual(55);
    expect(c).toBeGreaterThanOrEqual(25);
    expect(c).toBeLessThanOrEqual(35);
    expect(p).toBeGreaterThanOrEqual(15);
    expect(p).toBeLessThanOrEqual(25);
  });

  it("GEN-02: Deterministic output (same inputs + todayISO = identical plan)", () => {
    const inputs = createInputs();
    const a = generatePlan(inputs, { todayISO: TEST_TODAY });
    const b = generatePlan(inputs, { todayISO: TEST_TODAY });
    expect(a.days.length).toBe(b.days.length);
    expect(a.debugInfo?.totalScheduled).toBe(b.debugInfo?.totalScheduled);
    expect(a.debugInfo?.theoryScheduled).toBe(b.debugInfo?.theoryScheduled);
  });

  it("GEN-03: Final 2 weeks excluded from planning (minimal or no blocks)", () => {
    const inputs = createInputs({ examDate: "2025-03-12" });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const cap = plan.debugInfo?.capacity;
    expect(cap).toBeDefined();
    const effectiveDays = (cap!.effectivePlanningWeeks * 7);
    const planningDays = plan.days.slice(0, effectiveDays);
    const reserveDays = plan.days.slice(effectiveDays);
    reserveDays.forEach((d) => {
      expect(d.blocks.length).toBe(0);
    });
  });

  it("GEN-04: Buffer ratio reported correctly in debugInfo", () => {
    const inputs = createInputs();
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const cap = plan.debugInfo?.capacity;
    expect(cap).toBeDefined();
    const expected = cap!.availableEffectiveMinutes > 0
      ? (cap!.bufferMinutes / cap!.availableEffectiveMinutes)
      : 0;
    expect(cap!.bufferRatio).toBeCloseTo(expected, 6);
  });

  it("GEN-05: totalScheduled >= 0.95 * plannedMinutes when availability allows", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [8, 8, 8, 8, 8, 4, 4],
      examDate: "2025-03-12",
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const cap = plan.debugInfo?.capacity;
    const total = plan.debugInfo?.totalScheduled ?? 0;
    expect(cap).toBeDefined();
    if (cap!.bufferStatus === "good" || cap!.bufferStatus === "edge") {
      expect(total).toBeGreaterThanOrEqual(0.95 * cap!.plannedMinutes);
    }
  });

  it("GEN-06: No block exceeds 60 minutes", () => {
    const inputs = createInputs();
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    plan.days.forEach((day) => {
      day.blocks.forEach((b) => {
        expect(b.durationMinutes).toBeGreaterThan(0);
        expect(b.durationMinutes).toBeLessThanOrEqual(60);
      });
    });
  });

  it("GEN-07: Empty days for 0 availability", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 0, 0, 4, 0, 0, 0],
    });
    const plan = generatePlan(inputs, { todayISO: "2025-01-06" });
    const tue = plan.days[1];
    const wed = plan.days[2];
    expect(tue.blocks.length).toBe(0);
    expect(wed.blocks.length).toBe(0);
  });

  it("GEN-08: No single-stream weeks after week 2 (smoothing)", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [4, 4, 4, 4, 4, 4, 4],
      examDate: "2025-03-15",
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const actuals = plan.debugInfo?.weeklyActuals ?? [];
    const weeksAfterTwo = actuals.filter((w) => w.weekIndex > 2);
    for (const w of weeksAfterTwo) {
      if (w.totalMinutes < 60) continue;
      const streamsWithMinutes = [w.theoryMinutes, w.casesMinutes, w.programmingMinutes].filter((m) => m > 0).length;
      expect(streamsWithMinutes).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("generatePlan (edge cases)", () => {
  it("EDGE-01: Very short plan (< 3 weeks) – no crash", () => {
    const inputs = createInputs({
      examDate: "2025-01-14",
      availabilityHoursByWeekday: [2, 2, 2, 2, 2, 0, 0],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    expect(plan.days.length).toBeGreaterThan(0);
    expect(plan.debugInfo?.capacity.effectivePlanningWeeks).toBeLessThanOrEqual(1);
  });

  it("EDGE-02: Very low availability – bufferStatus warning, plan still generates", () => {
    const inputs = createInputs();
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    expect(plan.debugInfo?.capacity.bufferStatus).toBe("warning");
    expect(plan.days.length).toBeGreaterThan(0);
  });

  it("EDGE-03: High availability (buffer > 50%) – bufferStatus good, no over-scheduling", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [12, 12, 12, 12, 12, 6, 6],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    expect(plan.debugInfo?.capacity.bufferStatus).toBe("good");
    const total = plan.debugInfo?.totalScheduled ?? 0;
    expect(total).toBeLessThanOrEqual(plan.debugInfo!.capacity.availableEffectiveMinutes * 1.01);
  });

  it("EDGE-04: Uneven weekly availability – correct daily allocation", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [2, 8, 1, 8, 1, 0, 4],
    });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    expect(plan.days.length).toBeGreaterThan(0);
    plan.days.forEach((d, i) => {
      const expectedHours = inputs.availabilityHoursByWeekday[(new Date(plan.days[i].date).getDay() + 6) % 7] ?? 0;
      if (expectedHours < 15 / 60) expect(d.blocks.length).toBe(0);
    });
  });
});

describe("generatePlan (secondary activation)", () => {
  const SECONDARY_ACTIVITIES = ["PODCAST", "FLASHCARD", "QUIZ", "REVIEW"] as const;

  it("SEC-01: No secondary theory blocks for units with cumulative STUDY_THEME < 120", () => {
    const inputs = createInputs();
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    const studyThemeByUnit: Record<string, number> = {};
    const first14 = plan.days.slice(0, 14);
    for (const day of first14) {
      for (const b of day.blocks) {
        const act = b.activity;
        const unit = b.unit ?? null;
        if (act === "STUDY_THEME" && unit) {
          studyThemeByUnit[unit] = (studyThemeByUnit[unit] ?? 0) + b.durationMinutes;
        }
        if (SECONDARY_ACTIVITIES.includes(act as (typeof SECONDARY_ACTIVITIES)[number]) && unit) {
          const cum = studyThemeByUnit[unit] ?? 0;
          expect(cum).toBeGreaterThanOrEqual(120);
        }
      }
    }
  });

  it("SEC-02: Secondary allowed for primary unit on same day after first STUDY_THEME", () => {
    const inputs = createInputs({ availabilityHoursByWeekday: [4, 4, 4, 4, 4, 0, 0] });
    const plan = generatePlan(inputs, { todayISO: TEST_TODAY });
    let found = false;
    for (const day of plan.days) {
      let studyThemeUnit: string | null = null;
      let hasSecondaryForPrimary = false;
      for (const b of day.blocks) {
        if (b.activity === "STUDY_THEME" && b.unit) studyThemeUnit = b.unit;
        if (
          studyThemeUnit &&
          SECONDARY_ACTIVITIES.includes(b.activity as (typeof SECONDARY_ACTIVITIES)[number]) &&
          b.unit === studyThemeUnit
        ) {
          hasSecondaryForPrimary = true;
          break;
        }
      }
      if (hasSecondaryForPrimary) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
