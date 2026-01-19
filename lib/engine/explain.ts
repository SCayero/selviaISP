/**
 * Generate human-readable explanations for the study plan
 * Explains why the plan is structured the way it is
 */

import type { Plan, FormInputs } from "./types";

/**
 * Generate explanation bullets for the plan
 */
export function generateExplanations(plan: Plan, inputs: FormInputs): string[] {
  const explanations: string[] = [];

  // Daily quiz-first rule
  explanations.push(
    "Cada día comienza con un breve cuestionario para activar el recuerdo y evaluar tu progreso."
  );

  // Early period restriction
  explanations.push(
    "Durante las primeras 14 horas de estudio, el plan se enfoca únicamente en teoría y repasos para establecer una base sólida antes de actividades avanzadas."
  );

  // 48-hour review (best-effort)
  explanations.push(
    "Las unidades se repasan dentro de 48 horas después de su primer estudio, cuando el tiempo lo permite."
  );

  // 14-day hard guarantee
  const totalDays = plan.days.length;
  if (totalDays >= 15) {
    explanations.push(
      "Toda unidad estudiada se revisa de nuevo dentro de 14 días máximo como garantía."
    );
  }

  // Unlocked activities
  explanations.push(
    "Después de las primeras 14 horas, se activan casos prácticos, programación y simulacros para diversificar el aprendizaje."
  );

  // Simulation pairing
  explanations.push(
    "Cada simulacro va seguido inmediatamente de una sesión de feedback para maximizar el aprendizaje de errores."
  );

  // Diagnostic if applicable
  if (inputs.alreadyStudying && Object.keys(plan.masteryByUnit).length > 0) {
    explanations.push(
      "Se ha programado una evaluación diagnóstica inicial para estimar tu nivel actual de dominio en cada unidad."
    );
  }

  // Final phase
  explanations.push(
    "Los últimos 7 días se dedican a simulacros finales y repaso general para consolidar todo el conocimiento."
  );

  // Timeboxing
  explanations.push(
    "Las sesiones respetan límites de duración por tipo de actividad (teoría: 60min, casos: 45min, simulacros: 90min) para optimizar la concentración."
  );

  return explanations;
}
