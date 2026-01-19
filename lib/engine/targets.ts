/**
 * Target calculation for activity scheduling
 * Determines how many hours/sessions to allocate for each activity type
 */

import type { FormInputs, TargetConfig, GeneratorOptions } from "./types";

/**
 * Constants for target calculation
 */
export const TIME_CONDITION_THRESHOLD = 260; // hours - comfortable vs tight
export const EARLY_PERIOD_HOURS = 14;        // hours before unlocks
export const CASE_DURATION_MINUTES = 45;     // average case practice duration
export const SIM_DURATION_MINUTES = 90;      // simulation duration
export const FEEDBACK_DURATION_MINUTES = 30; // feedback session duration
export const PROGRAMMING_SESSION_MINUTES = 60; // programming session duration
export const REPASO_SESSION_MINUTES = 30;    // average repaso duration

/**
 * Calculate scheduling targets based on inputs and available time
 */
export function calculateTargets(
  inputs: FormInputs,
  totalDays: number,
  options?: GeneratorOptions
): TargetConfig {
  // Calculate total available hours
  const weeklyHours = inputs.availabilityHoursByWeekday.reduce((sum, h) => sum + h, 0);
  const totalWeeks = Math.ceil(totalDays / 7);
  const hoursAvailable = weeklyHours * totalWeeks;

  // Determine time condition
  const timeCondition: "comfortable" | "tight" =
    hoursAvailable >= TIME_CONDITION_THRESHOLD ? "comfortable" : "tight";

  // Apply defaults for optional inputs
  const themesCount = inputs.themesCount ?? 25;
  const planProgramming = inputs.planProgramming !== false; // Default true
  const studentType = inputs.studentType ?? (inputs.presentedBefore ? "repeat" : "new");

  // Calculate cases target
  // New students: 1 case per theme (basic coverage)
  // Repeat students: 2 cases per theme (deeper practice)
  const casesPerTheme = studentType === "repeat" ? 2 : 1;
  const casesTarget = themesCount * casesPerTheme;

  // Calculate programming hours target
  // 10% of available time if enabled
  const programmingHoursTarget = planProgramming
    ? Math.ceil(hoursAvailable * 0.1)
    : 0;

  // Calculate repaso sessions
  // Goal: revisit each theme 2-3 times over the plan
  const repasosPerTheme = timeCondition === "comfortable" ? 3 : 2;
  const repasosCount = themesCount * repasosPerTheme;

  // Calculate simulation counts
  // Comfortable: 4 theory sims, 3 case sims
  // Tight: 2 theory sims, 2 case sims
  const simTheoryCount = timeCondition === "comfortable" ? 4 : 2;
  const simCasesCount = timeCondition === "comfortable" ? 3 : 2;

  // Estimate total required hours
  const themeStudyHours = themesCount * 1.5; // ~1.5h per theme on average
  const casesHours = (casesTarget * CASE_DURATION_MINUTES) / 60;
  const programmingHours = programmingHoursTarget;
  const repasosHours = (repasosCount * REPASO_SESSION_MINUTES) / 60;
  const simTheoryHours = (simTheoryCount * (SIM_DURATION_MINUTES + FEEDBACK_DURATION_MINUTES)) / 60;
  const simCasesHours = (simCasesCount * (SIM_DURATION_MINUTES + FEEDBACK_DURATION_MINUTES)) / 60;

  const totalRequiredHours =
    themeStudyHours +
    casesHours +
    programmingHours +
    repasosHours +
    simTheoryHours +
    simCasesHours;

  // Check if we have enough time (90% threshold)
  const timeWarning = hoursAvailable < totalRequiredHours * 0.9;

  // Calculate additional pool for free study
  const additionalPool = Math.max(0, hoursAvailable - totalRequiredHours);

  return {
    hoursAvailable,
    timeCondition,
    casesTarget,
    programmingHoursTarget,
    repasosCount,
    simTheoryCount,
    simCasesCount,
    totalRequiredHours,
    timeWarning,
    additionalPool,
  };
}
