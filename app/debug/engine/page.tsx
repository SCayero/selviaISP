"use client";

import { useState, useMemo } from "react";
import { generatePlan } from "@/lib/engine/generator";
import type { FormInputs, Plan, DayPlan } from "@/lib/engine/types";

export default function EngineDebugPage() {
  // Hardcoded inputs for deterministic testing
  const formInputs: FormInputs = {
    examDate: "2026-07-27", // ISO format: YYYY-MM-DD
    availabilityHoursByWeekday: [4, 4, 4, 2, 2, 0, 4], // Mon-Sun
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
  };

  const pinnedToday = "2026-01-19";

  // Generate plan (memoized to prevent regeneration on every render)
  const plan = useMemo(() => {
    return generatePlan(formInputs, { todayISO: pinnedToday });
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalBlocks = plan.days.reduce((sum, day) => sum + day.blocks.length, 0);
    
    // Count by activity type
    const activityCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    
    plan.days.forEach(day => {
      day.blocks.forEach(block => {
        if (block.activity) {
          activityCounts[block.activity] = (activityCounts[block.activity] || 0) + 1;
        }
        typeCounts[block.type] = (typeCounts[block.type] || 0) + 1;
      });
    });

    return {
      totalDays: plan.days.length,
      totalBlocks,
      activityCounts,
      typeCounts,
    };
  }, [plan]);

  return (
    <div className="min-h-screen bg-bg px-4 py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text sm:text-3xl" style={{ fontWeight: 700 }}>
            Engine Debug View
          </h1>
          <a
            href="/"
            className="text-sm text-primary hover:underline"
            style={{ fontWeight: 500 }}
          >
            ← Back to Home
          </a>
        </div>

        {/* Input Summary */}
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
            <div>
              <span className="font-semibold" style={{ fontWeight: 600 }}>Presented Before:</span>{" "}
              {formInputs.presentedBefore ? "Yes" : "No"}
            </div>
          </div>
        </div>

        {/* Statistics Summary */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold text-text" style={{ fontWeight: 700 }}>
            Plan Statistics
          </h2>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Total Days</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>{stats.totalDays}</div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Total Blocks</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>{stats.totalBlocks}</div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Avg Blocks/Day</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>
                {(stats.totalBlocks / stats.totalDays).toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-bg p-3">
              <div className="text-xs text-muted" style={{ fontWeight: 500 }}>Weekly Summaries</div>
              <div className="text-2xl font-bold text-text" style={{ fontWeight: 700 }}>
                {plan.weeklySummaries.length}
              </div>
            </div>
          </div>

          {/* Activity Counts */}
          <div className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
              Counts by Activity Type
            </h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.activityCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([activity, count]) => (
                  <div key={activity} className="flex justify-between rounded bg-bg px-3 py-2">
                    <code className="text-xs">{activity}</code>
                    <span className="font-semibold" style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Type Counts */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-text" style={{ fontWeight: 600 }}>
              Counts by Block Type
            </h3>
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(stats.typeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => (
                  <div key={type} className="flex justify-between rounded bg-bg px-3 py-2">
                    <code className="text-xs">{type}</code>
                    <span className="font-semibold" style={{ fontWeight: 600 }}>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* First 3 Days Detail */}
        <div className="mb-6 rounded-lg border border-border bg-card p-4 shadow-soft">
          <h2 className="mb-3 text-lg font-semibold text-text" style={{ fontWeight: 700 }}>
            First 3 Days (Detailed)
          </h2>
          <div className="space-y-4">
            {plan.days.slice(0, 3).map((day, dayIndex) => (
              <div key={dayIndex} className="rounded-lg border border-border bg-bg p-4">
                <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <h3 className="font-semibold text-text" style={{ fontWeight: 700 }}>
                      Day {dayIndex + 1}: {day.date}
                    </h3>
                    <p className="text-xs text-muted" style={{ fontWeight: 400 }}>
                      {day.totalHours.toFixed(2)}h total • {day.blocks.length} blocks
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {day.blocks.map((block, blockIndex) => (
                    <div
                      key={blockIndex}
                      className="rounded border border-border bg-card p-3 text-xs"
                    >
                      <div className="mb-1 flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-1 flex flex-wrap gap-2">
                            {block.activity && (
                              <code className="rounded bg-primary px-1.5 py-0.5 font-semibold">
                                {block.activity}
                              </code>
                            )}
                            <code className="rounded bg-bg px-1.5 py-0.5">{block.type}</code>
                            <code className="rounded bg-bg px-1.5 py-0.5">{block.format}</code>
                            <code className="rounded bg-bg px-1.5 py-0.5">{block.selviaPhase}</code>
                          </div>
                          {block.unit && (
                            <div className="mb-1 text-text" style={{ fontWeight: 600 }}>
                              {block.unit}
                            </div>
                          )}
                          {block.caseNumber && (
                            <div className="text-muted">Case #{block.caseNumber}</div>
                          )}
                          {block.simulationNumber && (
                            <div className="text-muted">Simulation #{block.simulationNumber}</div>
                          )}
                          {block.pairedWithNext && (
                            <div className="text-accent" style={{ fontWeight: 500 }}>
                              ⚠️ Paired with next block
                            </div>
                          )}
                          {block.notes && (
                            <div className="mt-1 italic text-muted">{block.notes}</div>
                          )}
                        </div>
                        <div className="ml-2 text-right font-semibold text-text" style={{ fontWeight: 600 }}>
                          {block.durationMinutes}m
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Full Plan JSON */}
        <div className="rounded-lg border border-border bg-card p-4 shadow-soft">
          <details>
            <summary className="cursor-pointer text-lg font-semibold text-text hover:text-primary" style={{ fontWeight: 700 }}>
              Full Plan JSON (Click to expand)
            </summary>
            <pre className="mt-4 max-h-[600px] overflow-auto rounded bg-bg p-4 text-xs">
              {JSON.stringify(plan, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    </div>
  );
}
