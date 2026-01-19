"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FormField } from "@/components/FormField";
import { WeekdayHoursInput } from "@/components/WeekdayHoursInput";
import type { FormInputs, Stage } from "@/lib/engine/types";

const REGIONS = [
  "Madrid",
  "Cataluña",
  "Andalucía",
  "Valencia",
  "Galicia",
  "Castilla y León",
  "País Vasco",
  "Canarias",
  "Castilla-La Mancha",
  "Región de Murcia",
  "Aragón",
  "Extremadura",
  "Baleares",
  "Asturias",
  "Navarra",
  "Cantabria",
  "La Rioja",
  "Otro",
];

const TOTAL_STEPS = 3;

export default function CalculatorPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<FormInputs>({
    examDate: "",
    availabilityHoursByWeekday: [0, 0, 0, 0, 0, 0, 0],
    presentedBefore: false,
    alreadyStudying: false,
    region: "Madrid",
    stage: "Primaria",
  });

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      // Step 1: Exam info validation
      if (!formData.examDate) {
        newErrors.examDate = "La fecha del examen es requerida";
      } else {
        const examDate = new Date(formData.examDate + "T00:00:00");
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (examDate <= today) {
          newErrors.examDate = "La fecha del examen debe ser futura";
        }
      }

      if (!formData.region) {
        newErrors.region = "La región es requerida";
      }
    } else if (step === 2) {
      // Step 2: Availability validation
      const totalHours = formData.availabilityHoursByWeekday.reduce((sum, h) => sum + h, 0);
      if (totalHours === 0) {
        newErrors.availability = "Debes tener al menos algunas horas disponibles por semana";
      }
    }
    // Step 3 has no required fields, no validation needed

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < TOTAL_STEPS) {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(currentStep)) return;

    try {
      // Encode form data as base64 JSON
      const jsonData = JSON.stringify(formData);
      const encoded = btoa(jsonData);

      // Check URL length (base64 is ~33% longer than original)
      // If URL would exceed 2000 chars (including path), use sessionStorage
      const urlLength = `/results?data=${encoded}`.length;
      if (urlLength > 2000) {
        // Fallback to sessionStorage
        sessionStorage.setItem("selvia_form_data", jsonData);
        router.push("/results?storage=1");
      } else {
        // Use URL parameter
        router.push(`/results?data=${encoded}`);
      }
    } catch (error) {
      console.error("Error encoding form data:", error);
      // Fallback to sessionStorage on any error
      sessionStorage.setItem("selvia_form_data", JSON.stringify(formData));
      router.push("/results?storage=1");
    }
  };

  return (
    <div className="min-h-screen bg-bg px-4 py-12">
      <div className="mx-auto max-w-6xl px-4">
        <h1 className="mb-8 text-center text-4xl font-bold text-text" style={{ fontWeight: 700 }}>
          Calculadora de Plan de Estudio
        </h1>
        <p className="mb-8 text-center text-muted" style={{ fontWeight: 400 }}>
          Completa el formulario para generar tu plan personalizado
        </p>

        {/* Progress indicator */}
        <div className="mb-6 flex items-center justify-center sm:mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-semibold text-sm sm:h-10 sm:w-10 sm:text-base ${
                  step === currentStep
                    ? "border-primary bg-primary text-text"
                    : step < currentStep
                      ? "border-primary bg-primary text-text"
                      : "border-border bg-card text-muted"
                }`}
                style={{ fontWeight: 700 }}
              >
                {step < currentStep ? "✓" : step}
              </div>
              {step < TOTAL_STEPS && (
                <div
                  className={`mx-1 h-1 w-8 sm:mx-2 sm:w-16 ${
                    step < currentStep ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 shadow-soft sm:p-8">
          {/* Step 1: Exam Info */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-semibold text-text" style={{ fontWeight: 700 }}>Información del examen</h2>
                <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                  Proporciona los detalles básicos sobre tu examen de oposiciones
                </p>
              </div>

              <div className="space-y-6 rounded-lg bg-bg p-4 sm:p-6">
                <FormField label="Fecha del examen" required error={errors.examDate}>
                  <input
                    type="date"
                    value={formData.examDate}
                    onChange={(e) => setFormData({ ...formData, examDate: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-base text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
                  />
                  <p className="mt-1.5 text-xs text-muted">
                    Selecciona la fecha de tu examen de oposiciones
                  </p>
                </FormField>

                <FormField label="Comunidad Autónoma" required error={errors.region}>
                  <select
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-base text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
                  >
                    {REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-muted">
                    Selecciona la comunidad autónoma donde realizarás el examen
                  </p>
                </FormField>

                <FormField label="Etapa educativa" required>
                  <div className="space-y-3">
                    <label className="flex cursor-pointer items-center rounded-lg border border-border bg-card p-3 transition-colors hover:bg-bg">
                      <input
                        type="radio"
                        name="stage"
                        value="Infantil"
                        checked={formData.stage === "Infantil"}
                        onChange={(e) =>
                          setFormData({ ...formData, stage: e.target.value as Stage })
                        }
                        className="mr-3 h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="font-medium text-text" style={{ fontWeight: 500 }}>Infantil</span>
                    </label>
                    <label className="flex cursor-pointer items-center rounded-lg border border-border bg-card p-3 transition-colors hover:bg-bg">
                      <input
                        type="radio"
                        name="stage"
                        value="Primaria"
                        checked={formData.stage === "Primaria"}
                        onChange={(e) =>
                          setFormData({ ...formData, stage: e.target.value as Stage })
                        }
                        className="mr-3 h-4 w-4 text-primary focus:ring-primary"
                      />
                      <span className="font-medium text-text" style={{ fontWeight: 500 }}>Primaria</span>
                    </label>
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    Selecciona la etapa educativa para la que te estás preparando
                  </p>
                </FormField>
              </div>
            </div>
          )}

          {/* Step 2: Availability */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-semibold text-text" style={{ fontWeight: 700 }}>Disponibilidad</h2>
                <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                  Indica cuántas horas puedes dedicar al estudio cada día de la semana
                </p>
              </div>

              <div className="rounded-lg bg-bg p-4 sm:p-6">
                <FormField label="Horas disponibles por día" required error={errors.availability}>
                  <WeekdayHoursInput
                    value={formData.availabilityHoursByWeekday}
                    onChange={(value) =>
                      setFormData({ ...formData, availabilityHoursByWeekday: value })
                    }
                  />
                  <p className="mt-3 text-xs text-muted">
                    Puedes usar decimales (ej: 2.5 horas). El plan se adaptará a tu disponibilidad real.
                  </p>
                </FormField>
              </div>
            </div>
          )}

          {/* Step 3: Previous Experience */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="mb-6">
                <h2 className="mb-2 text-2xl font-semibold text-text" style={{ fontWeight: 700 }}>Experiencia previa</h2>
                <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                  Esta información ayuda a personalizar tu plan de estudio
                </p>
              </div>

              <div className="rounded-lg bg-bg p-4 sm:p-6">
                <FormField label="Experiencia previa">
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start rounded-lg border border-border bg-card p-4 transition-colors hover:bg-bg">
                      <input
                        type="checkbox"
                        checked={formData.presentedBefore}
                        onChange={(e) =>
                          setFormData({ ...formData, presentedBefore: e.target.checked })
                        }
                        className="mr-3 mt-0.5 h-4 w-4 flex-shrink-0 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-medium text-text" style={{ fontWeight: 500 }}>
                          Me he presentado antes a las oposiciones
                        </span>
                        <p className="mt-1 text-xs text-muted" style={{ fontWeight: 400 }}>
                          Si ya has realizado el examen antes, el plan aumentará los ejercicios prácticos
                        </p>
                      </div>
                    </label>
                    <label className="flex cursor-pointer items-start rounded-lg border border-border bg-card p-4 transition-colors hover:bg-bg">
                      <input
                        type="checkbox"
                        checked={formData.alreadyStudying}
                        onChange={(e) =>
                          setFormData({ ...formData, alreadyStudying: e.target.checked })
                        }
                        className="mr-3 mt-0.5 h-4 w-4 flex-shrink-0 text-primary focus:ring-primary"
                      />
                      <div>
                        <span className="font-medium text-text" style={{ fontWeight: 500 }}>
                          Ya estoy estudiando (evaluación diagnóstica)
                        </span>
                        <p className="mt-1 text-xs text-muted" style={{ fontWeight: 400 }}>
                          Si ya estás estudiando, se programará una evaluación diagnóstica inicial
                        </p>
                      </div>
                    </label>
                  </div>
                </FormField>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 1}
              className={`rounded-lg px-6 py-3 font-semibold transition-colors sm:px-8 ${
                currentStep === 1
                  ? "cursor-not-allowed bg-bg text-muted"
                  : "border border-border bg-card text-text hover:bg-bg"
              }`}
              style={{ fontWeight: currentStep === 1 ? 400 : 500 }}
            >
              Anterior
            </button>

            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                className="w-full rounded-lg bg-primary hover:bg-[var(--primary-hover)] px-6 py-3 font-semibold text-text shadow-soft transition-colors sm:w-auto sm:px-8"
                style={{ fontWeight: 500 }}
              >
                Siguiente
              </button>
            ) : (
              <button
                type="submit"
                className="w-full rounded-lg bg-primary hover:bg-[var(--primary-hover)] px-6 py-3 text-base font-bold text-text shadow-soft transition-all hover:shadow focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:w-auto sm:px-10 sm:py-4 sm:text-lg"
                style={{ fontWeight: 700 }}
              >
                Generar Plan de Estudio
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
