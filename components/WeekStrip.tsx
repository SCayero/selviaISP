import type { DayPlan } from "@/lib/engine/types";
import { getWeekdayName, formatDate } from "@/lib/utils/date";
import { PHASE_COLORS } from "@/lib/engine/rules";
import type { SelviaPhase } from "@/lib/engine/types";

interface WeekStripProps {
  days: DayPlan[];
  todayDate: string; // ISO date string for "today"
  selectedDate: string; // ISO date string for selected day
  onSelectDate: (date: string) => void;
}

export function WeekStrip({ days, todayDate, selectedDate, onSelectDate }: WeekStripProps) {
  // Get unique phases present in a day's blocks
  const getDayPhases = (day: DayPlan): SelviaPhase[] => {
    const phases = new Set<SelviaPhase>();
    day.blocks.forEach((block) => phases.add(block.selviaPhase));
    return Array.from(phases);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 sm:gap-3">
      {days.map((day) => {
        const isToday = day.date === todayDate;
        const isSelected = day.date === selectedDate;
        const dayPhases = getDayPhases(day);
        const hasActivities = day.blocks.length > 0;

        return (
          <button
            key={day.date}
            onClick={() => onSelectDate(day.date)}
            className={`
              flex min-w-[80px] flex-1 flex-col items-center gap-1.5 rounded-lg border p-2.5 text-center transition-all
              sm:min-w-[100px] sm:p-3
              ${isSelected ? "border-primary bg-primary shadow-soft" : "border-border bg-card hover:border-primary/50 hover:shadow-sm"}
              ${isToday && !isSelected ? "ring-2 ring-primary/30" : ""}
            `}
          >
            {/* Weekday */}
            <div
              className={`text-xs font-semibold sm:text-sm ${isSelected ? "text-text" : "text-muted"}`}
              style={{ fontWeight: 700 }}
            >
              {getWeekdayName(day.weekday).slice(0, 3)}
            </div>

            {/* Date */}
            <div
              className={`text-sm font-bold sm:text-base ${isSelected ? "text-text" : "text-text"}`}
              style={{ fontWeight: 700 }}
            >
              {formatDate(day.date).split("/")[0]}
            </div>

            {/* Phase indicators - small colored dots */}
            {hasActivities ? (
              <div className="flex flex-wrap items-center justify-center gap-1">
                {dayPhases.slice(0, 4).map((phase) => {
                  const phaseColor = PHASE_COLORS[phase];
                  return (
                    <div
                      key={phase}
                      className={`h-1.5 w-1.5 rounded-full ${phaseColor} sm:h-2 sm:w-2`}
                      title={phase}
                    />
                  );
                })}
                {dayPhases.length > 4 && (
                  <div className="text-[8px] text-muted sm:text-[10px]" style={{ fontWeight: 500 }}>
                    +{dayPhases.length - 4}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-1.5 w-1.5 sm:h-2 sm:w-2" />
            )}

            {/* Hours indicator */}
            {day.totalHours > 0 && (
              <div
                className={`text-[10px] font-semibold sm:text-xs ${isSelected ? "text-text/80" : "text-muted"}`}
                style={{ fontWeight: 600 }}
              >
                {day.totalHours.toFixed(1)}h
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
