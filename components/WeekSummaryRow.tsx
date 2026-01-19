import type { WeeklySummary } from "@/lib/engine/types";
import { PhaseBar } from "./PhaseBar";
import { formatDateLong } from "@/lib/utils/date";

interface WeekSummaryRowProps {
  summary: WeeklySummary;
}

export function WeekSummaryRow({ summary }: WeekSummaryRowProps) {
  const totalMinutes =
    summary.allocationByPhase.P1_CONTEXT +
    summary.allocationByPhase.P2_DEPTH +
    summary.allocationByPhase.P3_EVAL_REVIEW +
    summary.allocationByPhase.P4_PRACTICE;

  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-sm font-semibold text-text sm:text-base" style={{ fontWeight: 700 }}>
            Semana del {formatDateLong(summary.weekStartDate)}
          </h4>
          <p className="text-xs text-muted sm:text-sm" style={{ fontWeight: 400 }}>{summary.totalHours.toFixed(1)} horas totales</p>
        </div>
        <div className="text-left text-xs text-muted sm:text-right sm:text-sm" style={{ fontWeight: 400 }}>
          {Math.round(totalMinutes)} min
        </div>
      </div>
      <PhaseBar allocationByPhase={summary.allocationByPhase} totalMinutes={totalMinutes} />
    </div>
  );
}
