/**
 * Pass 1 capacity and planned workload calculation.
 * Planning weeks = total weeks until exam minus last 2 weeks.
 * Planned minutes from theory baseline; cases = 0.6 * theory, programming = 0.4 * theory.
 */

import type { FormInputs, PlanCapacity, GeneratorOptions } from "./types";
import { THEORY_ENVELOPE_MINUTES } from "./rules";
import { getTodayISO, addDays, getWeekday, diffDays } from "../utils/date";

/**
 * Map getWeekday (0=Sun .. 6=Sat) to availability index (0=Mon .. 6=Sun)
 */
function availabilityIndex(weekday: number): number {
  return weekday === 0 ? 6 : weekday - 1;
}

/**
 * Calculate PlanCapacity from form inputs and optional today override.
 */
export function calculateCapacity(
  inputs: FormInputs,
  options?: GeneratorOptions
): PlanCapacity {
  const today = options?.todayISO ?? getTodayISO();
  const examDate = inputs.examDate;
  const totalDays = diffDays(today, examDate);
  const totalWeeks = Math.ceil(totalDays / 7);
  const effectivePlanningWeeks = Math.max(0, totalWeeks - 2);
  const planningDays = effectivePlanningWeeks * 7;

  let availableEffectiveMinutes = 0;
  for (let d = 0; d < planningDays; d++) {
    const date = addDays(today, d);
    const wd = getWeekday(date);
    const idx = availabilityIndex(wd);
    const hours = inputs.availabilityHoursByWeekday[idx] ?? 0;
    availableEffectiveMinutes += hours * 60;
  }

  const unitsCount = inputs.themesCount ?? 20;
  const theoryPlanned = unitsCount * THEORY_ENVELOPE_MINUTES;
  const casesPlanned = Math.floor(theoryPlanned * 0.6);
  const programmingPlanned = Math.floor(theoryPlanned * 0.4);
  const plannedMinutes = theoryPlanned + casesPlanned + programmingPlanned;

  const bufferMinutes = availableEffectiveMinutes - plannedMinutes;
  const bufferRatio =
    availableEffectiveMinutes > 0 ? bufferMinutes / availableEffectiveMinutes : 0;
  const bufferStatus: PlanCapacity["bufferStatus"] =
    bufferRatio >= 0.2 ? "good" : bufferRatio >= 0.1 ? "edge" : "warning";

  return {
    totalWeeks,
    effectivePlanningWeeks,
    availableEffectiveMinutes,
    unitsCount,
    theoryPlanned,
    casesPlanned,
    programmingPlanned,
    plannedMinutes,
    bufferMinutes,
    bufferRatio,
    bufferStatus,
  };
}
