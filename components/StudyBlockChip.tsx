import type { StudyBlock } from "@/lib/engine/types";
import { PHASE_COLORS, PHASE_LABELS } from "@/lib/engine/rules";

interface StudyBlockChipProps {
  block: StudyBlock;
}

export function StudyBlockChip({ block }: StudyBlockChipProps) {
  const phaseColor = PHASE_COLORS[block.selviaPhase];
  const phaseLabel = PHASE_LABELS[block.selviaPhase];

  const typeLabels: Record<string, string> = {
    quiz: "📝 Cuestionario",
    new_content: "📚 Nuevo",
    review: "🔄 Repaso",
    practice: "✏️ Práctica",
    evaluation: "📊 Evaluación",
    recap: "📋 Resumen",
  };

  return (
    <div
      className={`rounded-md ${phaseColor} p-2 text-text shadow-sm transition-shadow hover:shadow`}
      title={block.notes || `${phaseLabel} - ${typeLabels[block.type] || block.type}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold leading-tight" style={{ fontWeight: 700 }}>{phaseLabel}</div>
          <div className="mt-0.5 text-xs leading-tight" style={{ fontWeight: 400 }}>{typeLabels[block.type] || block.type}</div>
          {block.unit && (
            <div className="mt-1 truncate text-xs opacity-90" style={{ fontWeight: 400 }}>{block.unit}</div>
          )}
        </div>
        <div className="flex-shrink-0 text-right text-xs font-semibold" style={{ fontWeight: 700 }}>
          {block.durationMinutes}m
        </div>
      </div>
    </div>
  );
}
