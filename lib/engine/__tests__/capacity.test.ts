/**
 * Unit tests for Pass 1 capacity calculation (CAP-01 through CAP-10)
 */

import { describe, it, expect } from "vitest";
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

describe("calculateCapacity", () => {
  it("CAP-01: Correct effectivePlanningWeeks (totalWeeks=10 -> 8)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.totalWeeks).toBe(10);
    expect(cap.effectivePlanningWeeks).toBe(8);
  });

  it("CAP-02: Correct availableEffectiveMinutes (20h/week * 8 weeks = 9600)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.availableEffectiveMinutes).toBe(9600);
  });

  it("CAP-03: Correct theoryPlanned (20 units * 510 = 10200)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.unitsCount).toBe(20);
    expect(cap.theoryPlanned).toBe(10200);
  });

  it("CAP-04: Correct casesPlanned (10200 * 0.6 = 6120)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.casesPlanned).toBe(6120);
  });

  it("CAP-05: Correct programmingPlanned (10200 * 0.4 = 4080)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.programmingPlanned).toBe(4080);
  });

  it("CAP-06: Correct plannedMinutes (10200 + 6120 + 4080 = 20400)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.plannedMinutes).toBe(20400);
  });

  it("CAP-07: Final ratios are 50/30/20 (theory/cases/programming of total)", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    const t = cap.theoryPlanned / cap.plannedMinutes;
    const c = cap.casesPlanned / cap.plannedMinutes;
    const p = cap.programmingPlanned / cap.plannedMinutes;
    expect(t).toBeCloseTo(0.5, 5);
    expect(c).toBeCloseTo(0.3, 5);
    expect(p).toBeCloseTo(0.2, 5);
  });

  it("CAP-08: bufferStatus = good when bufferRatio >= 0.20", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [12, 12, 12, 12, 12, 6, 6],
    });
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.bufferRatio).toBeGreaterThanOrEqual(0.2);
    expect(cap.bufferStatus).toBe("good");
  });

  it("CAP-09: bufferStatus = edge when 0.10 <= bufferRatio < 0.20", () => {
    const inputs = createInputs({
      availabilityHoursByWeekday: [8, 8, 8, 8, 8, 4, 4],
    });
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.bufferRatio).toBeGreaterThanOrEqual(0.1);
    expect(cap.bufferRatio).toBeLessThan(0.2);
    expect(cap.bufferStatus).toBe("edge");
  });

  it("CAP-10: bufferStatus = warning when bufferRatio < 0.10", () => {
    const inputs = createInputs();
    const cap = calculateCapacity(inputs, { todayISO: "2025-01-01" });
    expect(cap.bufferRatio).toBeLessThan(0.1);
    expect(cap.bufferStatus).toBe("warning");
  });
});
