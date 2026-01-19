import type { DayPlan } from "@/lib/engine/types";
import { StudyBlockChip } from "./StudyBlockChip";
import { getWeekdayName, formatDate } from "@/lib/utils/date";

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
        {day.blocks.map((block, index) => (
          <div key={index} className="rounded-lg border border-border p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <StudyBlockChip block={block} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted sm:text-sm">
                  <span style={{ fontWeight: 500 }}>
                    {formatLabels[block.format] || block.format}
                  </span>
                  <span className="text-border">•</span>
                  <span style={{ fontWeight: 600 }}>
                    {block.durationMinutes} min
                  </span>
                </div>
                {block.unit && (
                  <div className="mb-1 text-sm font-semibold text-text sm:text-base" style={{ fontWeight: 600 }}>
                    {block.unit}
                  </div>
                )}
                {block.notes && (
                  <div className="mt-1.5 text-xs text-muted italic sm:text-sm" style={{ fontWeight: 400 }}>
                    {block.notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
