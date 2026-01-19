/**
 * Selvia Method V0 - Core Plan Generator
 * Deterministic study plan generation engine
 */

import type {
  FormInputs,
  Plan,
  DayPlan,
  StudyBlock,
  WeeklySummary,
  SelviaPhase,
  GeneratorOptions,
  ActivityType,
  TargetConfig,
} from "./types";
import {
  UNIT_COUNT,
  UNIT_NAMES,
  MAX_BLOCK_DURATION,
  MIN_BLOCK_DURATION,
  BLOCKS_PER_DAY,
  REVIEW_48H_WINDOW,
  REVIEW_14D_HARD_LIMIT,
  LOW_AVAILABILITY_THRESHOLD,
  QUIZ_BLOCK_DURATION,
  PHASE_DEFINITIONS,
} from "./rules";
import { scheduleDiagnostics, estimateMastery } from "./diagnostics";
import { generateExplanations } from "./explain";
import {
  getTodayISO,
  addDays,
  getWeekday,
  diffDays,
  getWeekStart,
  getNowISO,
} from "../utils/date";
import { calculateTargets } from "./targets";
import { checkUnlocks, SESSION_CAPS, requiresFeedbackPair, getFeedbackActivity } from "./policy";

/**
 * Map ActivityType to backward-compatible StudyBlock fields
 */
function mapActivityToBlock(
  activity: ActivityType,
  durationMinutes: number,
  unit: string | null = null,
  caseNumber?: number,
  simulationNumber?: number
): Omit<StudyBlock, "notes"> {
  const baseBlock = {
    durationMinutes,
    activity,
    caseNumber,
    simulationNumber,
  };

  switch (activity) {
    case "THEME_STUDY":
      return {
        ...baseBlock,
        selviaPhase: "P2_DEPTH",
        type: "new_content",
        unit,
        format: "raw_content",
      };
    case "REPASO_BLOCK":
      return {
        ...baseBlock,
        selviaPhase: "P3_EVAL_REVIEW",
        type: "review",
        unit,
        format: "flashcards",
      };
    case "CASE_PRACTICE":
      return {
        ...baseBlock,
        selviaPhase: "P4_PRACTICE",
        type: "practice",
        unit: null,
        format: "quiz",
      };
    case "PROGRAMMING":
      return {
        ...baseBlock,
        selviaPhase: "P2_DEPTH",
        type: "new_content",
        unit: "Programación",
        format: "raw_content",
      };
    case "SIM_THEORY":
    case "FINAL_SIM_THEORY":
      return {
        ...baseBlock,
        selviaPhase: "P3_EVAL_REVIEW",
        type: "evaluation",
        unit: null,
        format: "quiz",
        pairedWithNext: true,
      };
    case "SIM_CASES":
    case "FINAL_SIM_CASES":
      return {
        ...baseBlock,
        selviaPhase: "P3_EVAL_REVIEW",
        type: "evaluation",
        unit: null,
        format: "quiz",
        pairedWithNext: true,
      };
    case "FEEDBACK_THEORY":
    case "FEEDBACK_CASES":
      return {
        ...baseBlock,
        selviaPhase: "P3_EVAL_REVIEW",
        type: "review",
        unit: null,
        format: "summary",
      };
    case "FREE_STUDY":
      return {
        ...baseBlock,
        selviaPhase: "P2_DEPTH",
        type: "practice",
        unit: null,
        format: "raw_content",
      };
    case "FINAL_REPASO_GENERAL":
      return {
        ...baseBlock,
        selviaPhase: "P4_PRACTICE",
        type: "recap",
        unit: null,
        format: "flashcards",
      };
    default:
      return {
        ...baseBlock,
        selviaPhase: "P2_DEPTH",
        type: "new_content",
        unit,
        format: "raw_content",
      };
  }
}

/**
 * Generate complete study plan from user inputs
 */
export function generatePlan(inputs: FormInputs, options?: GeneratorOptions): Plan {
  // Determine today date (for deterministic testing)
  const today = options?.todayISO || getTodayISO();
  const examDate = inputs.examDate;
  const totalDays = diffDays(today, examDate);

  // Calculate targets
  const targets = calculateTargets(inputs, totalDays, options);

  // Initialize mastery tracking (empty unless alreadyStudying)
  const masteryByUnit: Record<string, number> = {};

  // Schedule diagnostics if already studying
  let diagnosticSchedule = null;
  if (inputs.alreadyStudying && totalDays > 0) {
    diagnosticSchedule = scheduleDiagnostics(inputs, totalDays);
    // Estimate mastery for all units
    UNIT_NAMES.forEach((unit, index) => {
      masteryByUnit[unit] = estimateMastery(inputs, index);
    });
  }

  // Track unit study history
  const lastStudiedAt: Record<string, string> = {}; // unit -> ISO date
  const firstStudiedAt: Record<string, string> = {}; // unit -> ISO date
  const coveredUnits: Set<string> = new Set();
  let nextUnitIndex = 0; // For assigning new units

  // Track activity completion
  let accumulatedHours = 0;
  let casesCompleted = 0;
  let programmingHoursCompleted = 0;
  let repasosCompleted = 0;
  let simTheoryCompleted = 0;
  let simCasesCompleted = 0;

  // Generate day-by-day schedule
  const days: DayPlan[] = [];

  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const currentDate = addDays(today, dayIndex);
    const weekday = getWeekday(currentDate);
    const availableHours = inputs.availabilityHoursByWeekday[weekday === 0 ? 6 : weekday - 1]; // Convert Sunday=0 to Sunday=6
    const availableMinutes = availableHours * 60;
    const daysRemaining = totalDays - dayIndex;

    const blocks: StudyBlock[] = [];

    // Handle zero availability (rest day)
    if (availableMinutes === 0) {
      days.push({
        date: currentDate,
        weekday,
        totalHours: 0,
        blocks: [],
      });
      continue;
    }

    // Handle low availability (< 30 minutes) - only quiz block
    if (availableMinutes < LOW_AVAILABILITY_THRESHOLD) {
      blocks.push({
        selviaPhase: "P3_EVAL_REVIEW",
        type: "quiz",
        unit: null,
        format: "quiz",
        durationMinutes: Math.min(availableMinutes, QUIZ_BLOCK_DURATION),
        notes: "Sesión ligera - solo cuestionario",
      });

      days.push({
        date: currentDate,
        weekday,
        totalHours: blocks.reduce((sum, b) => sum + b.durationMinutes, 0) / 60,
        blocks,
      });
      continue;
    }

    // Check unlock state
    const unlocks = checkUnlocks(accumulatedHours, daysRemaining);

    // Normal day scheduling
    let remainingMinutes = availableMinutes;

    // ALWAYS start with quiz block (10-15 minutes)
    const quizDuration = Math.min(QUIZ_BLOCK_DURATION, remainingMinutes);
    blocks.push({
      selviaPhase: "P3_EVAL_REVIEW",
      type: "quiz",
      unit: null,
      format: "quiz",
      durationMinutes: quizDuration,
      notes: "Cuestionario diario de activación",
    });
    remainingMinutes -= quizDuration;

    // Check for diagnostic evaluation (only in diagnostic days)
    const isDiagnosticDay = diagnosticSchedule?.diagnosticDays.includes(dayIndex) ?? false;
    if (isDiagnosticDay && remainingMinutes >= MIN_BLOCK_DURATION) {
      const evalDuration = Math.min(MAX_BLOCK_DURATION, Math.floor(remainingMinutes * 0.3)); // 30% of remaining time
      blocks.push({
        selviaPhase: "P3_EVAL_REVIEW",
        type: "evaluation",
        unit: null,
        format: "quiz",
        durationMinutes: Math.max(MIN_BLOCK_DURATION, evalDuration),
        notes: "Evaluación diagnóstica",
      });
      remainingMinutes -= blocks[blocks.length - 1].durationMinutes;
    }

    // Priority 1: 14-day hard revisit (highest priority) - map to REPASO_BLOCK
    const criticalReviews: { unit: string; daysSinceLastStudy: number }[] = [];
    Object.keys(lastStudiedAt).forEach((unit) => {
      const daysSince = diffDays(lastStudiedAt[unit], currentDate);
      if (daysSince >= REVIEW_14D_HARD_LIMIT) {
        criticalReviews.push({ unit, daysSinceLastStudy: daysSince });
      }
    });
    criticalReviews.sort((a, b) => b.daysSinceLastStudy - a.daysSinceLastStudy); // Most overdue first

    // Schedule critical 14-day reviews as REPASO_BLOCK
    for (const review of criticalReviews) {
      if (remainingMinutes < MIN_BLOCK_DURATION) break;

      const reviewDuration = Math.min(
        SESSION_CAPS.REPASO_BLOCK,
        Math.max(MIN_BLOCK_DURATION, Math.floor(remainingMinutes / 2))
      );
      const blockData = mapActivityToBlock("REPASO_BLOCK", reviewDuration, review.unit);
      blocks.push({
        ...blockData,
        notes: `Revisión obligatoria (${review.daysSinceLastStudy} días desde última vez)`,
      });
      remainingMinutes -= reviewDuration;
      lastStudiedAt[review.unit] = currentDate; // Update last studied
      repasosCompleted++;
    }

    // Priority 2: 48-hour reviews (best-effort) - map to REPASO_BLOCK
    const deferred48hReviews: { unit: string; firstStudied: string }[] = [];
    Object.keys(firstStudiedAt).forEach((unit) => {
      const daysSinceFirst = diffDays(firstStudiedAt[unit], currentDate);
      const lastStudyDays = lastStudiedAt[unit] ? diffDays(lastStudiedAt[unit], currentDate) : daysSinceFirst;

      // If first studied 1-2 days ago and not yet reviewed
      if (daysSinceFirst >= 1 && daysSinceFirst <= REVIEW_48H_WINDOW && lastStudyDays === daysSinceFirst) {
        deferred48hReviews.push({ unit, firstStudied: firstStudiedAt[unit] });
      }
    });

    // Schedule 48h reviews if time allows
    for (const review of deferred48hReviews) {
      if (remainingMinutes < MIN_BLOCK_DURATION) break;

      const reviewDuration = Math.min(
        SESSION_CAPS.REPASO_BLOCK,
        Math.max(MIN_BLOCK_DURATION, Math.floor(remainingMinutes * 0.25))
      );
      const blockData = mapActivityToBlock("REPASO_BLOCK", reviewDuration, review.unit);
      blocks.push({
        ...blockData,
        notes: "Repaso ligero dentro de 48h",
      });
      remainingMinutes -= reviewDuration;
      lastStudiedAt[review.unit] = currentDate;
      repasosCompleted++;
    }

    // Priority 3: Activity selection based on unlock state and targets
    const targetBlocks = Math.min(
      BLOCKS_PER_DAY.max,
      Math.max(
        BLOCKS_PER_DAY.min,
        Math.ceil(remainingMinutes / (MAX_BLOCK_DURATION * 0.8))
      )
    );
    const currentBlockCount = blocks.length;
    const blocksToAdd = Math.min(targetBlocks - currentBlockCount, Math.ceil(remainingMinutes / MIN_BLOCK_DURATION));

    // Track if we need feedback pairing
    let needsFeedback: ActivityType | null = null;

    for (let i = 0; i < blocksToAdd && remainingMinutes >= MIN_BLOCK_DURATION; i++) {
      let activity: ActivityType;
      let unit: string | null = null;
      let caseNum: number | undefined;
      let simNum: number | undefined;
      let notes = "";

      // If previous block needs feedback, schedule it immediately
      if (needsFeedback) {
        activity = getFeedbackActivity(needsFeedback);
        const feedbackDuration = Math.min(
          SESSION_CAPS[activity],
          Math.max(MIN_BLOCK_DURATION, remainingMinutes)
        );
        const blockData = mapActivityToBlock(activity, feedbackDuration);
        blocks.push({
          ...blockData,
          notes: "Revisión de feedback del simulacro",
        });
        remainingMinutes -= feedbackDuration;
        needsFeedback = null;
        continue;
      }

      // Determine activity based on phase
      if (unlocks.finalPhaseActive) {
        // Final 7 days: prioritize final simulations and general repaso
        if (simTheoryCompleted < targets.simTheoryCount && remainingMinutes >= SESSION_CAPS.FINAL_SIM_THEORY + SESSION_CAPS.FEEDBACK_THEORY) {
          activity = "FINAL_SIM_THEORY";
          simNum = simTheoryCompleted + 1;
          notes = `Simulacro final de teoría #${simNum}`;
          needsFeedback = activity;
          simTheoryCompleted++;
        } else if (simCasesCompleted < targets.simCasesCount && remainingMinutes >= SESSION_CAPS.FINAL_SIM_CASES + SESSION_CAPS.FEEDBACK_CASES) {
          activity = "FINAL_SIM_CASES";
          simNum = simCasesCompleted + 1;
          notes = `Simulacro final de casos #${simNum}`;
          needsFeedback = activity;
          simCasesCompleted++;
        } else {
          activity = "FINAL_REPASO_GENERAL";
          notes = "Repaso general final";
        }
      } else if (!unlocks.casesUnlocked && !unlocks.programmingUnlocked && !unlocks.simulationsUnlocked) {
        // Early period: only THEME_STUDY
        activity = "THEME_STUDY";
        if (nextUnitIndex < UNIT_NAMES.length) {
          unit = UNIT_NAMES[nextUnitIndex];
          if (!firstStudiedAt[unit]) {
            firstStudiedAt[unit] = currentDate;
          }
          lastStudiedAt[unit] = currentDate;
          coveredUnits.add(unit);
          nextUnitIndex++;
          notes = `Estudio de ${unit}`;
        } else {
          notes = "Estudio de contenido teórico";
        }
      } else {
        // After unlock: rotate through activities based on targets
        const rotationIndex = (dayIndex + i) % 4;

        if (rotationIndex === 0 && casesCompleted < targets.casesTarget) {
          // Cases practice
          activity = "CASE_PRACTICE";
          caseNum = casesCompleted + 1;
          notes = `Caso práctico #${caseNum}`;
          casesCompleted++;
        } else if (rotationIndex === 1 && programmingHoursCompleted < targets.programmingHoursTarget && inputs.planProgramming !== false) {
          // Programming
          activity = "PROGRAMMING";
          notes = "Sesión de programación";
          programmingHoursCompleted += 0.5; // Track in increments
        } else if (rotationIndex === 2 && simTheoryCompleted < targets.simTheoryCount && remainingMinutes >= SESSION_CAPS.SIM_THEORY + SESSION_CAPS.FEEDBACK_THEORY) {
          // Theory simulation
          activity = "SIM_THEORY";
          simNum = simTheoryCompleted + 1;
          notes = `Simulacro de teoría #${simNum}`;
          needsFeedback = activity;
          simTheoryCompleted++;
        } else if (rotationIndex === 3 && simCasesCompleted < targets.simCasesCount && remainingMinutes >= SESSION_CAPS.SIM_CASES + SESSION_CAPS.FEEDBACK_CASES) {
          // Cases simulation
          activity = "SIM_CASES";
          simNum = simCasesCompleted + 1;
          notes = `Simulacro de casos #${simNum}`;
          needsFeedback = activity;
          simCasesCompleted++;
        } else {
          // Default: THEME_STUDY
          activity = "THEME_STUDY";
          if (nextUnitIndex < UNIT_NAMES.length) {
            unit = UNIT_NAMES[nextUnitIndex];
            if (!firstStudiedAt[unit]) {
              firstStudiedAt[unit] = currentDate;
            }
            lastStudiedAt[unit] = currentDate;
            coveredUnits.add(unit);
            nextUnitIndex++;
            notes = `Estudio de ${unit}`;
          } else {
            notes = "Estudio de contenido teórico";
          }
        }
      }

      // Calculate block duration respecting session caps
      const activityCap = SESSION_CAPS[activity] || MAX_BLOCK_DURATION;
      const blockDuration = Math.min(
        activityCap,
        Math.max(MIN_BLOCK_DURATION, Math.floor(remainingMinutes / (blocksToAdd - i)))
      );

      const blockData = mapActivityToBlock(activity, blockDuration, unit, caseNum, simNum);
      blocks.push({
        ...blockData,
        notes,
      });

      remainingMinutes -= blockDuration;
    }

    // Fill any residual time with FREE_STUDY
    if (remainingMinutes >= MIN_BLOCK_DURATION) {
      const freeStudyDuration = Math.min(SESSION_CAPS.FREE_STUDY, remainingMinutes);
      const blockData = mapActivityToBlock("FREE_STUDY", freeStudyDuration);
      blocks.push({
        ...blockData,
        notes: "Tiempo libre para reforzar áreas de interés",
      });
      remainingMinutes -= freeStudyDuration;
    }

    // Calculate day total
    const dayTotalHours = blocks.reduce((sum, b) => sum + b.durationMinutes, 0) / 60;
    
    days.push({
      date: currentDate,
      weekday,
      totalHours: dayTotalHours,
      blocks,
    });

    // Update accumulated hours for unlock tracking
    accumulatedHours += dayTotalHours;
  }

  // Generate weekly summaries
  const weeklySummaries: WeeklySummary[] = [];
  const weekMap = new Map<string, WeeklySummary>();

  days.forEach((day) => {
    const weekStart = getWeekStart(day.date);
    let summary = weekMap.get(weekStart);
    if (!summary) {
      summary = {
        weekStartDate: weekStart,
        totalHours: 0,
        allocationByPhase: {
          P1_CONTEXT: 0,
          P2_DEPTH: 0,
          P3_EVAL_REVIEW: 0,
          P4_PRACTICE: 0,
        },
      };
      weekMap.set(weekStart, summary);
    }

    summary.totalHours += day.totalHours;
    day.blocks.forEach((block) => {
      summary.allocationByPhase[block.selviaPhase] += block.durationMinutes;
    });
  });

  weeklySummaries.push(...Array.from(weekMap.values()));

  // Generate explanations
  const plan: Plan = {
    meta: {
      generatedAt: getNowISO(),
      today,
      examDate,
      region: inputs.region,
      stage: inputs.stage,
      unitsTotal: UNIT_COUNT,
    },
    phases: PHASE_DEFINITIONS,
    masteryByUnit,
    days,
    weeklySummaries,
    explanations: [],
  };

  plan.explanations = generateExplanations(plan, inputs);

  return plan;
}
