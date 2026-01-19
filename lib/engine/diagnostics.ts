/**
 * Diagnostic evaluation scheduling and mastery estimation
 * Used when alreadyStudying = true
 */

import type { FormInputs, DiagnosticSchedule } from "./types";
import { DIAGNOSTIC_DAYS } from "./rules";

/**
 * Schedule diagnostic evaluation blocks in the first days of the plan
 * Returns day indices (0-based) when diagnostics should run
 */
export function scheduleDiagnostics(
  inputs: FormInputs,
  totalDays: number
): DiagnosticSchedule {
  // Calculate weekly available hours
  const weeklyHours = inputs.availabilityHoursByWeekday.reduce((sum, hours) => sum + hours, 0);

  // Determine diagnostic days based on availability
  // Higher availability = more diagnostic days (up to max)
  let totalDiagnosticDays: number;
  if (weeklyHours >= 20) {
    totalDiagnosticDays = DIAGNOSTIC_DAYS.max; // 5 days
  } else if (weeklyHours >= 10) {
    totalDiagnosticDays = 4;
  } else {
    totalDiagnosticDays = DIAGNOSTIC_DAYS.min; // 3 days
  }

  // Cap at total available days
  totalDiagnosticDays = Math.min(totalDiagnosticDays, totalDays);

  // Schedule diagnostics in first consecutive days (0, 1, 2, ...)
  const diagnosticDays: number[] = Array.from({ length: totalDiagnosticDays }, (_, i) => i);

  return {
    diagnosticDays,
    totalDiagnosticDays,
  };
}

/**
 * Estimate mastery level for a unit (0-100) based on deterministic heuristics
 *
 * Heuristic:
 * - Base: 50 (neutral starting point)
 * - If presentedBefore: +15 (previous exposure helps)
 * - Unit index adjustment: earlier units (1-5) get +5, mid units (6-15) neutral, later units (16-20) -5
 * - Clamp to 0-100 range
 *
 * This is deterministic and testable - same inputs always produce same mastery.
 */
export function estimateMastery(inputs: FormInputs, unitIndex: number): number {
  let mastery = 50; // Base score

  // Previous presentation bonus
  if (inputs.presentedBefore) {
    mastery += 15;
  }

  // Unit index adjustment (earlier units slightly higher by default)
  if (unitIndex < 5) {
    // Units 1-5: +5 (often covered first)
    mastery += 5;
  } else if (unitIndex >= 15) {
    // Units 16-20: -5 (often covered later or rushed)
    mastery -= 5;
  }
  // Units 6-15: neutral (no adjustment)

  // Clamp to valid range
  return Math.max(0, Math.min(100, mastery));
}
