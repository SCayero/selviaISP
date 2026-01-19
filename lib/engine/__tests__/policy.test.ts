/**
 * Unit tests for policy module
 */

import { describe, it, expect } from "vitest";
import {
  checkUnlocks,
  requiresFeedbackPair,
  getFeedbackActivity,
  splitRepasoAcrossDays,
  SESSION_CAPS,
} from "../policy";
import { EARLY_PERIOD_HOURS } from "../targets";

describe("checkUnlocks", () => {
  it("unlocks cases/programming/simulations after 14 hours", () => {
    const before = checkUnlocks(13, 30);
    const at = checkUnlocks(14, 30);
    const after = checkUnlocks(15, 30);

    // Before 14h: nothing unlocked
    expect(before.casesUnlocked).toBe(false);
    expect(before.programmingUnlocked).toBe(false);
    expect(before.simulationsUnlocked).toBe(false);

    // At exactly 14h: everything unlocked
    expect(at.casesUnlocked).toBe(true);
    expect(at.programmingUnlocked).toBe(true);
    expect(at.simulationsUnlocked).toBe(true);

    // After 14h: everything unlocked
    expect(after.casesUnlocked).toBe(true);
    expect(after.programmingUnlocked).toBe(true);
    expect(after.simulationsUnlocked).toBe(true);
  });

  it("activates final phase in last 7 days", () => {
    const before = checkUnlocks(50, 8);
    const at = checkUnlocks(50, 7);
    const during = checkUnlocks(50, 3);

    expect(before.finalPhaseActive).toBe(false);
    expect(at.finalPhaseActive).toBe(true);
    expect(during.finalPhaseActive).toBe(true);
  });

  it("tracks accumulated hours correctly", () => {
    const unlocks = checkUnlocks(25.5, 15);
    expect(unlocks.accumulatedHours).toBe(25.5);
  });
});

describe("SESSION_CAPS", () => {
  it("defines caps for all activity types", () => {
    expect(SESSION_CAPS.THEME_STUDY).toBe(60);
    expect(SESSION_CAPS.REPASO_BLOCK).toBe(45);
    expect(SESSION_CAPS.CASE_PRACTICE).toBe(45);
    expect(SESSION_CAPS.PROGRAMMING).toBe(60);
    expect(SESSION_CAPS.SIM_THEORY).toBe(90);
    expect(SESSION_CAPS.SIM_CASES).toBe(90);
    expect(SESSION_CAPS.FEEDBACK_THEORY).toBe(30);
    expect(SESSION_CAPS.FEEDBACK_CASES).toBe(30);
    expect(SESSION_CAPS.FREE_STUDY).toBe(30);
  });
});

describe("requiresFeedbackPair", () => {
  it("returns true for simulation activities", () => {
    expect(requiresFeedbackPair("SIM_THEORY")).toBe(true);
    expect(requiresFeedbackPair("SIM_CASES")).toBe(true);
  });

  it("returns false for non-simulation activities", () => {
    expect(requiresFeedbackPair("THEME_STUDY")).toBe(false);
    expect(requiresFeedbackPair("REPASO_BLOCK")).toBe(false);
    expect(requiresFeedbackPair("CASE_PRACTICE")).toBe(false);
    expect(requiresFeedbackPair("PROGRAMMING")).toBe(false);
    expect(requiresFeedbackPair("FEEDBACK_THEORY")).toBe(false);
    expect(requiresFeedbackPair("FEEDBACK_CASES")).toBe(false);
    expect(requiresFeedbackPair("FREE_STUDY")).toBe(false);
  });
});

describe("getFeedbackActivity", () => {
  it("returns FEEDBACK_THEORY for theory simulations", () => {
    expect(getFeedbackActivity("SIM_THEORY")).toBe("FEEDBACK_THEORY");
    expect(getFeedbackActivity("FINAL_SIM_THEORY")).toBe("FEEDBACK_THEORY");
  });

  it("returns FEEDBACK_CASES for case simulations", () => {
    expect(getFeedbackActivity("SIM_CASES")).toBe("FEEDBACK_CASES");
    expect(getFeedbackActivity("FINAL_SIM_CASES")).toBe("FEEDBACK_CASES");
  });

  it("throws error for non-simulation activities", () => {
    expect(() => getFeedbackActivity("THEME_STUDY" as any)).toThrow();
    expect(() => getFeedbackActivity("FREE_STUDY" as any)).toThrow();
  });
});

describe("splitRepasoAcrossDays", () => {
  it("distributes repasos evenly across days", () => {
    const distribution = splitRepasoAcrossDays(10, 5);
    expect(distribution).toHaveLength(5);
    expect(distribution.reduce((sum, n) => sum + n, 0)).toBe(10);
    // Should be [2, 2, 2, 2, 2]
    expect(distribution.every(n => n === 2)).toBe(true);
  });

  it("handles remainder by distributing to early days", () => {
    const distribution = splitRepasoAcrossDays(11, 5);
    expect(distribution).toHaveLength(5);
    expect(distribution.reduce((sum, n) => sum + n, 0)).toBe(11);
    // Should be [3, 2, 2, 2, 2] (remainder of 1 goes to first day)
    expect(distribution[0]).toBe(3);
    expect(distribution.slice(1).every(n => n === 2)).toBe(true);
  });

  it("returns empty array when no days available", () => {
    const distribution = splitRepasoAcrossDays(10, 0);
    expect(distribution).toEqual([]);
  });

  it("returns all zeros when no repasos", () => {
    const distribution = splitRepasoAcrossDays(0, 5);
    expect(distribution).toEqual([0, 0, 0, 0, 0]);
  });

  it("handles more days than repasos", () => {
    const distribution = splitRepasoAcrossDays(3, 10);
    expect(distribution).toHaveLength(10);
    expect(distribution.reduce((sum, n) => sum + n, 0)).toBe(3);
    // First 3 days get 1 repaso each, rest get 0
    expect(distribution.slice(0, 3).every(n => n === 1)).toBe(true);
    expect(distribution.slice(3).every(n => n === 0)).toBe(true);
  });
});
