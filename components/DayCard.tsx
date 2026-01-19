import type { DayPlan } from "@/lib/engine/types";
import { StudyBlockChip } from "./StudyBlockChip";
import { getWeekdayName, formatDate } from "@/lib/utils/date";

interface DayCardProps {
  day: DayPlan;
}

export function DayCard({ day }: DayCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-3 shadow-soft sm:p-4">
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-text truncate" style={{ fontWeight: 700 }}>{formatDate(day.date)}</h3>
          <p className="text-xs text-muted sm:text-sm" style={{ fontWeight: 400 }}>{getWeekdayName(day.weekday)}</p>
        </div>
        <div className="ml-2 text-right">
          <div className="text-base font-bold text-primary sm:text-lg" style={{ fontWeight: 700 }}>
            {day.totalHours.toFixed(1)}h
          </div>
          {day.totalHours === 0 && (
            <div className="text-xs text-muted" style={{ fontWeight: 400 }}>Descanso</div>
          )}
        </div>
      </div>

      {day.blocks.length === 0 ? (
        <p className="text-xs text-muted italic sm:text-sm" style={{ fontWeight: 400 }}>Sin sesiones programadas</p>
      ) : (
        <div className="space-y-1.5">
          {day.blocks.map((block, index) => (
            <StudyBlockChip key={index} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
