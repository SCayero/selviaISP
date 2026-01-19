import type { SelviaPhase } from "@/lib/engine/types";
import { PHASE_COLORS, PHASE_LABELS } from "@/lib/engine/rules";

interface PhaseBarProps {
  allocationByPhase: Record<SelviaPhase, number>;
  totalMinutes: number;
}

export function PhaseBar({ allocationByPhase, totalMinutes }: PhaseBarProps) {
  const phases: SelviaPhase[] = ["P1_CONTEXT", "P2_DEPTH", "P3_EVAL_REVIEW", "P4_PRACTICE"];

  return (
    <div className="flex h-8 rounded-md overflow-hidden border border-border">
      {phases.map((phase) => {
        const minutes = allocationByPhase[phase];
        const percentage = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
        const color = PHASE_COLORS[phase];

        if (minutes === 0) return null;

        return (
          <div
            key={phase}
            className={`${color} flex items-center justify-center text-xs font-semibold text-text`}
            style={{ width: `${percentage}%`, fontWeight: 700 }}
            title={`${PHASE_LABELS[phase]}: ${minutes} min`}
          >
            {percentage > 10 && `${Math.round(percentage)}%`}
          </div>
        );
      })}
    </div>
  );
}
