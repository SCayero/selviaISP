/**
 * Policy module for unlock rules and session constraints
 * Implements gates and limits for activity scheduling
 */

import type { ActivityType } from "./types";
import { EARLY_PERIOD_HOURS } from "./targets";

/**
 * Unlock state tracking
 */
export interface UnlockState {
  accumulatedHours: number;
  casesUnlocked: boolean;        // After 14h
  programmingUnlocked: boolean;  // After 14h
  simulationsUnlocked: boolean;  // After 14h
  finalPhaseActive: boolean;     // Last 7 days
}

/**
 * Check what activities are unlocked based on progress
 */
export function checkUnlocks(
  accumulatedHours: number,
  daysRemaining: number
): UnlockState {
  const earlyPeriodComplete = accumulatedHours >= EARLY_PERIOD_HOURS;

  return {
    accumulatedHours,
    casesUnlocked: earlyPeriodComplete,
    programmingUnlocked: earlyPeriodComplete,
    simulationsUnlocked: earlyPeriodComplete,
    finalPhaseActive: daysRemaining <= 7,
  };
}

/**
 * Session duration caps (in minutes)
 */
export const SESSION_CAPS: Record<ActivityType, number> = {
  THEME_STUDY: 60,
  REPASO_BLOCK: 45,
  CASE_PRACTICE: 45,
  PROGRAMMING: 60,
  SIM_THEORY: 90,
  SIM_CASES: 90,
  FEEDBACK_THEORY: 30,
  FEEDBACK_CASES: 30,
  FREE_STUDY: 30,
  FINAL_REPASO_GENERAL: 45,
  FINAL_SIM_THEORY: 90,
  FINAL_SIM_CASES: 90,
};

/**
 * Check if an activity requires a feedback pair
 */
export function requiresFeedbackPair(activity: ActivityType): boolean {
  return activity === "SIM_THEORY" || activity === "SIM_CASES";
}

/**
 * Get the feedback activity for a simulation
 */
export function getFeedbackActivity(simActivity: ActivityType): ActivityType {
  if (simActivity === "SIM_THEORY" || simActivity === "FINAL_SIM_THEORY") {
    return "FEEDBACK_THEORY";
  }
  if (simActivity === "SIM_CASES" || simActivity === "FINAL_SIM_CASES") {
    return "FEEDBACK_CASES";
  }
  throw new Error(`Activity ${simActivity} does not have a feedback pair`);
}

/**
 * Split repaso sessions across available days
 * Returns array of repaso counts per day
 */
export function splitRepasoAcrossDays(
  totalRepasos: number,
  availableDays: number
): number[] {
  if (availableDays === 0) return [];
  if (totalRepasos === 0) return Array(availableDays).fill(0);

  const repasosPerDay = Math.floor(totalRepasos / availableDays);
  const remainder = totalRepasos % availableDays;

  const distribution: number[] = Array(availableDays).fill(repasosPerDay);

  // Distribute remainder evenly across days
  for (let i = 0; i < remainder; i++) {
    distribution[i]++;
  }

  return distribution;
}
