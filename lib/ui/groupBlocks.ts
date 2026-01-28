import type { StudyBlock, ActivityType, SelviaPhase, BlockType, BlockFormat } from "@/lib/engine/types";

export interface GroupedBlock {
  activity: ActivityType | undefined;
  unit: string | null;
  totalDurationMinutes: number;
  mergedFromCount: number;
  originalBlockIndices: number[];
  displayNotes: string;
  /** First block's id (optional; matches StudyBlock.id) */
  id?: string;
  // Keep first block's metadata for rendering
  selviaPhase: SelviaPhase;
  type: BlockType;
  format: BlockFormat;
}

/**
 * Groups consecutive blocks with the same activity and unit into single display slots.
 * This is a presentation-layer transformation only - does not modify engine output.
 * 
 * Grouping rules:
 * - Blocks must be adjacent (consecutive in the array)
 * - block.activity must be identical (both undefined counts as match)
 * - block.unit must be identical (both null counts as match)
 * 
 * @param blocks Array of StudyBlock objects to group
 * @returns Array of GroupedBlock objects representing merged slots
 */
export function groupConsecutiveBlocks(blocks: StudyBlock[]): GroupedBlock[] {
  if (blocks.length === 0) {
    return [];
  }

  const grouped: GroupedBlock[] = [];

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];

    // Check if this block can be merged with the last grouped slot
    if (grouped.length > 0) {
      const lastGrouped = grouped[grouped.length - 1];
      
      // Check if mergeable: same activity and same unit
      const activityMatch = lastGrouped.activity === block.activity;
      const unitMatch = lastGrouped.unit === block.unit;

      if (activityMatch && unitMatch) {
        // Merge with previous slot
        lastGrouped.totalDurationMinutes += block.durationMinutes;
        lastGrouped.mergedFromCount += 1;
        lastGrouped.originalBlockIndices.push(i);
        
        // Update displayNotes: use first block's notes, append merge hint
        const firstBlockIndex = lastGrouped.originalBlockIndices[0];
        const firstBlockNotes = blocks[firstBlockIndex].notes || "";
        if (lastGrouped.mergedFromCount > 1) {
          lastGrouped.displayNotes = firstBlockNotes 
            ? `${firstBlockNotes} (+${lastGrouped.mergedFromCount} bloques)`
            : `(+${lastGrouped.mergedFromCount} bloques)`;
        }
        continue;
      }
    }

    // Cannot merge - create new grouped slot
    const groupedBlock: GroupedBlock = {
      activity: block.activity,
      unit: block.unit,
      totalDurationMinutes: block.durationMinutes,
      mergedFromCount: 1,
      originalBlockIndices: [i],
      displayNotes: block.notes || "",
      id: block.id,
      selviaPhase: block.selviaPhase,
      type: block.type,
      format: block.format,
    };

    grouped.push(groupedBlock);
  }

  return grouped;
}
