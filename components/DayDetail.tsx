import type { DayPlan } from "@/lib/engine/types";
import { StudyBlockChip } from "./StudyBlockChip";
import { getWeekdayName, formatDate } from "@/lib/utils/date";
import { groupConsecutiveBlocks } from "@/lib/ui/groupBlocks";

interface DayDetailProps {
  day: DayPlan | null;
}

export function DayDetail({ day }: DayDetailProps) {
  if (!day) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 shadow-soft text-center">
        <p className="text-muted" style={{ fontWeight: 400 }}>
          Selecciona un día para ver los detalles
        </p>
      </div>
    );
  }

  const hasNoActivities = day.blocks.length === 0 || day.totalHours === 0;

  if (hasNoActivities) {
    return (
      <div className="bg-card border border-border rounded-lg p-6 shadow-soft text-center">
        <p className="text-sm text-muted sm:text-base" style={{ fontWeight: 400 }}>
          No hay estudio planificado para este día según tu disponibilidad.
        </p>
      </div>
    );
  }

  const typeLabels: Record<string, string> = {
    quiz: "📝 Cuestionario",
    new_content: "📚 Nuevo",
    review: "🔄 Repaso",
    practice: "✏️ Práctica",
    evaluation: "📊 Evaluación",
    recap: "📋 Resumen",
  };

  const formatLabels: Record<string, string> = {
    raw_content: "Contenido",
    summary: "Resumen",
    flashcards: "Tarjetas",
    audio: "Audio",
    video: "Video",
    quiz: "Quiz",
  };

  const activityLabels: Record<string, string> = {
    THEME_STUDY: "📚 Estudio de tema",
    REPASO_BLOCK: "🔄 Repaso",
    CASE_PRACTICE: "✏️ Caso práctico",
    PROGRAMMING: "💻 Programación",
    SIM_THEORY: "📊 Simulacro teoría",
    SIM_CASES: "📊 Simulacro casos",
    FEEDBACK_THEORY: "📝 Feedback teoría",
    FEEDBACK_CASES: "📝 Feedback casos",
    FINAL_REPASO_GENERAL: "🔄 Repaso general final",
    FINAL_SIM_THEORY: "📊 Simulacro final teoría",
    FINAL_SIM_CASES: "📊 Simulacro final casos",
  };

  // Group consecutive blocks with same activity and unit
  const groupedBlocks = groupConsecutiveBlocks(day.blocks);

  return (
    <div className="bg-card border border-border rounded-lg p-4 shadow-soft sm:p-6">
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="text-lg font-semibold text-text sm:text-xl" style={{ fontWeight: 700 }}>
          {formatDate(day.date)} - {getWeekdayName(day.weekday)}
        </h3>
        <p className="text-sm text-muted sm:text-base" style={{ fontWeight: 400 }}>
          {day.totalHours.toFixed(1)} horas totales
        </p>
      </div>

      <div className="space-y-3">
        {groupedBlocks.map((groupedBlock, index) => {
          // Create a pseudo-block for StudyBlockChip (it only uses phase/type for rendering)
          const displayBlock = {
            selviaPhase: groupedBlock.selviaPhase,
            type: groupedBlock.type,
            unit: groupedBlock.unit,
            format: groupedBlock.format,
            durationMinutes: groupedBlock.totalDurationMinutes,
            notes: groupedBlock.displayNotes,
          };

          return (
            <div key={index} className="rounded-lg border border-border p-3 sm:p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <StudyBlockChip block={displayBlock} />
                </div>
                <div className="min-w-0 flex-1">
                  {groupedBlock.activity && (
                    <div className="mb-1.5 text-xs font-semibold text-primary sm:text-sm" style={{ fontWeight: 600 }}>
                      {activityLabels[groupedBlock.activity] || groupedBlock.activity}
                    </div>
                  )}
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted sm:text-sm">
                    <span style={{ fontWeight: 500 }}>
                      {formatLabels[groupedBlock.format] || groupedBlock.format}
                    </span>
                    <span className="text-border">•</span>
                    <span style={{ fontWeight: 600 }}>
                      {groupedBlock.totalDurationMinutes} min
                      {groupedBlock.totalDurationMinutes >= 60 && ` (${(groupedBlock.totalDurationMinutes / 60).toFixed(1)}h)`}
                    </span>
                    {groupedBlock.mergedFromCount > 1 && (
                      <>
                        <span className="text-border">•</span>
                        <span className="text-muted" style={{ fontWeight: 400 }}>
                          ({groupedBlock.mergedFromCount} bloques)
                        </span>
                      </>
                    )}
                  </div>
                  {groupedBlock.unit && (
                    <div className="mb-1 text-sm font-semibold text-text sm:text-base" style={{ fontWeight: 600 }}>
                      {groupedBlock.unit}
                    </div>
                  )}
                  {groupedBlock.displayNotes && (
                    <div className="mt-1.5 text-xs text-muted italic sm:text-sm" style={{ fontWeight: 400 }}>
                      {groupedBlock.displayNotes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
