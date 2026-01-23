"use client";

import { useState, useMemo } from "react";
import { generatePlan } from "@/lib/engine/generator";
import type { FormInputs, Plan, WeeklyActual } from "@/lib/engine/types";
import { groupConsecutiveBlocks } from "@/lib/ui/groupBlocks";

export default function EngineDebugPage() {
  const formInputs: FormInputs = {
    examDate: "2026-07-27",
    availabilityHoursByWeekday: [4, 4, 4, 2, 2, 0, 4],
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
  };

  const pinnedToday = "2026-01-19";

  const plan = useMemo(() => {
    return generatePlan(formInputs, { todayISO: pinnedToday });
  }, []);

  const sanitizedPlan = useMemo(() => {
    const sanitized = JSON.parse(JSON.stringify(plan)) as Plan;
    sanitized.meta.generatedAt = "DEBUG_FIXED";
    return sanitized;
  }, [plan]);

  function getActivityStream(activity: string | undefined): "theory" | "cases" | "programming" {
    if (!activity) return "theory";
    switch (activity) {
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
      default:
        return "theory";
    }
  }

  const activityMinutes = useMemo(() => {
    const acc: Record<string, number> = {};
    plan.days.forEach((day) => {
      day.blocks.forEach((block) => {
        if (block.activity) {
          acc[block.activity] = (acc[block.activity] || 0) + block.durationMinutes;
        }
      });
    });
    return acc;
  }, [plan]);

  const cap = plan.debugInfo?.capacity;
  const di = plan.debugInfo;

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text sm:text-3xl" style={{ fontWeight: 700 }}>
            Engine Debug View (Pass 1)
          </h1>
          <a href="/" className="text-sm text-primary hover:underline" style={{ fontWeight: 500 }}>
            ← Back to Home
          </a>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold text-text" style={{ fontWeight: 700 }}>
            Test Inputs
          </h2>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Today (pinned):</span>{" "}
              <code className="rounded bg-bg px-1.5 py-0.5">{pinnedToday}</code>
            </div>
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Exam Date:</span>{" "}
              <code className="rounded bg-bg px-1.5 py-0.5">{formInputs.examDate}</code>
            </div>
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Availability:</span>{" "}
              <code className="rounded bg-bg px-1.5 py-0.5">{JSON.stringify(formInputs.availabilityHoursByWeekday)}</code>
            </div>
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Region:</span> {formInputs.region}
            </div>
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Stage:</span> {formInputs.stage}
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold text-text" style={{ fontWeight: 700 }}>
            Plan Statistics
          </h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Total Days</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>{plan.days.length}</div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Total Minutes Scheduled</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>
                {(di?.totalScheduled ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                ({(di ? di.totalScheduled / 60 : 0).toFixed(1)} hours)
              </div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Weekly Summaries</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>{plan.weeklySummaries.length}</div>
            </div>
          </div>

          {cap && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
                Capacity
              </h3>
              <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded bg-bg px-3 py-2">
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>Total / Effective Weeks</div>
                  <div className="font-bold text-text" style={{ fontWeight: 600 }}>{cap.totalWeeks} / {cap.effectivePlanningWeeks}</div>
                </div>
                <div className="rounded bg-bg px-3 py-2">
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>Available Effective Minutes</div>
                  <div className="font-bold text-text" style={{ fontWeight: 600 }}>{cap.availableEffectiveMinutes.toLocaleString()}m ({(cap.availableEffectiveMinutes / 60).toFixed(0)}h)</div>
                </div>
                <div className="rounded bg-bg px-3 py-2">
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>Planned Minutes</div>
                  <div className="font-bold text-text" style={{ fontWeight: 600 }}>{cap.plannedMinutes.toLocaleString()}m</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                    Theory {cap.theoryPlanned}m · Cases {cap.casesPlanned}m · Prog {cap.programmingPlanned}m
                  </div>
                </div>
                <div className="rounded bg-bg px-3 py-2">
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>Buffer</div>
                  <div className="font-bold text-text" style={{ fontWeight: 600 }}>{cap.bufferMinutes.toLocaleString()}m</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                    {(cap.bufferRatio * 100).toFixed(1)}% — <span className={cap.bufferStatus === "good" ? "text-green-600" : cap.bufferStatus === "edge" ? "text-amber-600" : "text-red-600"}>{cap.bufferStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {di && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
                Allocation (50 / 30 / 20 target)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg bg-bg p-3">
                  <div className="mb-1 text-xs font-semibold text-text" style={{ fontWeight: 600 }}>THEORY</div>
                  <div className="text-xl font-bold text-text" style={{ fontWeight: 700 }}>{di.theoryScheduled.toLocaleString()}m</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                    {(di.theoryRatio * 100).toFixed(1)}% {di.totalScheduled > 0 ? `(target 50%)` : ""}
                  </div>
                </div>
                <div className="rounded-lg bg-bg p-3">
                  <div className="mb-1 text-xs font-semibold text-text" style={{ fontWeight: 600 }}>CASES</div>
                  <div className="text-xl font-bold text-text" style={{ fontWeight: 700 }}>{di.casesScheduled.toLocaleString()}m</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                    {(di.casesRatio * 100).toFixed(1)}% (target 30%)
                  </div>
                </div>
                <div className="rounded-lg bg-bg p-3">
                  <div className="mb-1 text-xs font-semibold text-text" style={{ fontWeight: 600 }}>PROGRAMMING</div>
                  <div className="text-xl font-bold text-text" style={{ fontWeight: 700 }}>{di.programmingScheduled.toLocaleString()}m</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                    {(di.programmingRatio * 100).toFixed(1)}% (target 20%)
                  </div>
                </div>
                <div className="rounded-lg bg-bg p-3">
                  <div className="mb-1 text-xs font-semibold text-text" style={{ fontWeight: 600 }}>Starvation Weeks</div>
                  <div className="text-xl font-bold text-text" style={{ fontWeight: 700 }}>{di.starvationWeeks}</div>
                  <div className="text-xs text-muted" style={{ fontWeight: 400 }}>weeks with 0 cases/prog while remaining &gt; 0</div>
                </div>
                {typeof di.weeksWithFullPresence === "number" && typeof di.totalWeeksAfterTwo === "number" && (
                  <div className="rounded-lg bg-bg p-3">
                    <div className="mb-1 text-xs font-semibold text-text" style={{ fontWeight: 600 }}>Weeks with full presence</div>
                    <div className="text-xl font-bold text-text" style={{ fontWeight: 700 }}>
                      {di.weeksWithFullPresence} / {di.totalWeeksAfterTwo}
                    </div>
                    <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                      {di.totalWeeksAfterTwo > 0
                        ? `${((di.weeksWithFullPresence / di.totalWeeksAfterTwo) * 100).toFixed(0)}% of weeks after week 2 have all 3 streams ≥60m`
                        : "N/A"}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {di?.weeklyActuals && di.weeklyActuals.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
                Weekly Actuals
              </h3>
              <div className="space-y-2">
                {di.weeklyActuals.map((wa: WeeklyActual, i: number) => {
                  const missing = wa.missingStreams ?? [];
                  const hasMissing = missing.length > 0;
                  return (
                    <div
                      key={wa.weekStart}
                      className={`rounded p-3 text-xs ${
                        hasMissing ? "border border-amber-500 bg-amber-500/10" : "bg-bg"
                      }`}
                    >
                      <div className="font-semibold text-text" style={{ fontWeight: 600 }}>
                        Week {wa.weekIndex}: {wa.weekStart}
                      </div>
                      <div className="mt-1 grid grid-cols-3 gap-2 text-muted" style={{ fontWeight: 400 }}>
                        <div>Theory: {wa.theoryMinutes}m</div>
                        <div>Cases: {wa.casesMinutes}m</div>
                        <div>Prog: {wa.programmingMinutes}m</div>
                      </div>
                      <div className="mt-1 text-muted" style={{ fontWeight: 400 }}>Total: {wa.totalMinutes}m</div>
                      {hasMissing && (
                        <div className="mt-1 font-semibold text-red-600" style={{ fontWeight: 600 }}>
                          Missing: {missing.join(", ")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
              Breakdown by Activity (minutes)
            </h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(activityMinutes)
                .sort((a, b) => b[1] - a[1])
                .map(([activity, minutes]) => (
                  <div key={activity} className="flex justify-between rounded bg-bg px-3 py-2">
                    <code className="text-xs">{activity}</code>
                    <span className="font-semibold" style={{ fontWeight: 600 }}>{minutes.toLocaleString()}m</span>
                  </div>
                ))}
            </div>
          </div>

          {di && cap && (
            <div className="rounded-lg border-2 border-primary bg-bg p-3">
              <h3 className="mb-2 text-sm font-semibold text-primary" style={{ fontWeight: 700 }}>
                Plan Signature
              </h3>
              <div className="grid gap-2 text-xs font-mono sm:grid-cols-2">
                <div><span className="text-muted">THEORY:</span> <span className="font-bold text-text">{di.theoryScheduled}m</span></div>
                <div><span className="text-muted">CASES:</span> <span className="font-bold text-text">{di.casesScheduled}m</span></div>
                <div><span className="text-muted">PROGRAMMING:</span> <span className="font-bold text-text">{di.programmingScheduled}m</span></div>
                <div><span className="text-muted">BUFFER_RATIO:</span> <span className="font-bold text-text">{(cap.bufferRatio * 100).toFixed(1)}%</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold text-text" style={{ fontWeight: 700 }}>
            First 3 Days (Detailed)
          </h2>
          <div className="space-y-4">
            {plan.days.slice(0, 3).map((day, dayIndex) => {
              const groupedBlocks = groupConsecutiveBlocks(day.blocks);
              return (
                <div key={dayIndex} className="rounded-lg border border-border bg-bg p-4">
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                    <div>
                      <h3 className="font-semibold text-text" style={{ fontWeight: 700 }}>
                        Day {dayIndex + 1}: {day.date}
                      </h3>
                      <p className="text-xs text-muted" style={{ fontWeight: 400 }}>
                        {day.totalHours.toFixed(2)}h total · {day.blocks.length} blocks · {groupedBlocks.length} grouped slots
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {groupedBlocks.map((groupedBlock, blockIndex) => (
                      <div key={blockIndex} className="rounded border border-border bg-card p-3 text-xs">
                        <div className="mb-1 flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-1 flex flex-wrap gap-2">
                              {groupedBlock.activity && (
                                <code className="rounded bg-primary px-1.5 py-0.5 font-semibold">{groupedBlock.activity}</code>
                              )}
                              <code className="rounded bg-bg px-1.5 py-0.5">{groupedBlock.type}</code>
                              <code className="rounded bg-bg px-1.5 py-0.5">{groupedBlock.format}</code>
                              <code className="rounded bg-bg px-1.5 py-0.5">{groupedBlock.selviaPhase}</code>
                              {groupedBlock.mergedFromCount > 1 && (
                                <code className="rounded bg-accent px-1.5 py-0.5 text-text" style={{ fontWeight: 600 }}>
                                  {groupedBlock.mergedFromCount} blocks merged
                                </code>
                              )}
                            </div>
                            {groupedBlock.unit && (
                              <div className="mb-1 text-text" style={{ fontWeight: 600 }}>{groupedBlock.unit}</div>
                            )}
                            {groupedBlock.displayNotes && (
                              <div className="mt-1 italic text-muted">{groupedBlock.displayNotes}</div>
                            )}
                          </div>
                          <div className="ml-2 text-right font-semibold text-text" style={{ fontWeight: 600 }}>
                            {groupedBlock.totalDurationMinutes}m
                            {groupedBlock.totalDurationMinutes >= 60 && (
                              <div className="text-xs text-muted" style={{ fontWeight: 400 }}>
                                ({(groupedBlock.totalDurationMinutes / 60).toFixed(1)}h)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-text hover:text-primary" style={{ fontWeight: 700 }}>
              Full Plan JSON (Click to expand)
            </summary>
            <pre className="mt-4 max-h-[600px] overflow-auto rounded bg-bg p-4 text-xs">
              {JSON.stringify(sanitizedPlan, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
