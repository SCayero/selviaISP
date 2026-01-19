"use client";

import { useEffect, useState, Suspense, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Plan, FormInputs } from "@/lib/engine/types";
import { generatePlan } from "@/lib/engine/generator";
import { WeekStrip } from "@/components/WeekStrip";
import { DayDetail } from "@/components/DayDetail";
import { ExplanationList } from "@/components/ExplanationList";
import { diffDays, formatDate, getWeekStart, addDays } from "@/lib/utils/date";

function ResultsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // All hooks must be called unconditionally at the top
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Compute weekDays using useMemo (safe even if plan is null)
  const weekDays = useMemo(() => {
    if (!plan) return [];
    const weekStart = getWeekStart(plan.meta.today);
    const days: typeof plan.days = [];
    for (let i = 0; i < 7; i++) {
      const targetDate = addDays(weekStart, i);
      const dayInPlan = plan.days.find((d) => d.date === targetDate);
      if (dayInPlan) {
        days.push(dayInPlan);
      }
    }
    return days;
  }, [plan]);

  // Compute default selected date (safe even if weekDays is empty)
  const defaultSelectedDate = useMemo(() => {
    if (!plan || weekDays.length === 0) return "";
    return weekDays.find((d) => d.date === plan.meta.today)?.date || weekDays[0]?.date || "";
  }, [plan, weekDays]);

  // Set selectedDate once weekDays/defaultSelectedDate is available
  useEffect(() => {
    if (!selectedDate && defaultSelectedDate) {
      setSelectedDate(defaultSelectedDate);
    }
  }, [defaultSelectedDate, selectedDate]);

  // Generate plan in useEffect
  useEffect(() => {
    try {
      let formDataJson: string | null = null;

      // Check if using sessionStorage
      const useStorage = searchParams.get("storage") === "1";
      if (useStorage) {
        formDataJson = sessionStorage.getItem("selvia_form_data");
        if (!formDataJson) {
          setError("No se encontraron datos del formulario. Por favor, completa el formulario de nuevo.");
          setLoading(false);
          return;
        }
      } else {
        // Try to get from URL
        const dataParam = searchParams.get("data");
        if (!dataParam) {
          setError("No se encontraron datos del formulario. Por favor, completa el formulario de nuevo.");
          setLoading(false);
          return;
        }

        try {
          formDataJson = atob(dataParam);
        } catch (decodeError) {
          setError("Error al decodificar los datos. Por favor, completa el formulario de nuevo.");
          setLoading(false);
          return;
        }
      }

      // Parse and validate form data
      const formData: FormInputs = JSON.parse(formDataJson);

      // Generate plan
      const generatedPlan = generatePlan(formData);
      setPlan(generatedPlan);
    } catch (err) {
      console.error("Error generating plan:", err);
      setError("Error al generar el plan. Por favor, intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  // Compute derived values using useMemo (safe even if plan is null)
  const daysUntilExam = useMemo(() => {
    if (!plan) return 0;
    return diffDays(plan.meta.today, plan.meta.examDate);
  }, [plan]);

  const weeklyHours = useMemo(() => {
    if (!plan || daysUntilExam === 0) return 0;
    return plan.days.reduce((sum, day) => sum + day.totalHours, 0) / Math.ceil(daysUntilExam / 7);
  }, [plan, daysUntilExam]);

  const currentFocus = useMemo(() => {
    if (!plan) return "Preparación inicial";
    const firstActiveDay = plan.days.find((day) => day.blocks.length > 0);
    const currentFocusBlock = firstActiveDay?.blocks.find((block) => block.unit && block.type !== "quiz");
    return currentFocusBlock?.unit || firstActiveDay?.blocks[0]?.unit || "Preparación inicial";
  }, [plan]);

  const selectedDay = useMemo(() => {
    if (!plan || !selectedDate) return null;
    return plan.days.find((d) => d.date === selectedDate) || null;
  }, [plan, selectedDate]);

  // Conditional rendering AFTER all hooks
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mb-2 text-2xl font-semibold text-text sm:text-3xl" style={{ fontWeight: 700 }}>
            Generando tu plan...
          </div>
          <div className="text-sm text-muted sm:text-base" style={{ fontWeight: 400 }}>
            Por favor, espera un momento
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-12">
        <div className="w-full max-w-md bg-card border border-border rounded-lg p-6 shadow-soft text-center sm:p-8">
          <div className="mb-4 text-xl font-semibold text-accent sm:text-2xl" style={{ fontWeight: 700 }}>Error</div>
          <p className="mb-6 text-text sm:text-base" style={{ fontWeight: 400 }}>{error}</p>
          <Link
            href="/calculator"
            className="inline-block rounded-lg bg-primary hover:bg-[var(--primary-hover)] px-6 py-3 font-semibold text-text shadow-soft transition-colors sm:px-8"
            style={{ fontWeight: 500 }}
          >
            Volver al Formulario
          </Link>
        </div>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-bg px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Top Summary Strip */}
        <div className="mb-6 rounded-lg border border-border bg-primary p-4 shadow-soft sm:p-6">
          <div className="space-y-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
            <div className="flex-1">
              <h1 className="mb-2 text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>
                Tu Plan de Estudio Ideal
              </h1>
              <div className="text-xs text-muted sm:text-sm lg:text-base" style={{ fontWeight: 400 }}>
                {formatDate(plan.meta.examDate)} • {plan.meta.region} • {plan.meta.stage}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-6">
              <div className="text-center">
                <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Días</div>
                <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{daysUntilExam}</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Horas/sem</div>
                <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{weeklyHours > 0 ? weeklyHours.toFixed(1) : "0"}</div>
              </div>
              <div className="text-center">
                <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Unidades</div>
                <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{plan.meta.unitsTotal}</div>
              </div>
              <div className="col-span-2 text-center sm:col-span-1">
                <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Foco</div>
                <div className="text-sm font-semibold text-text truncate sm:text-base lg:text-lg" title={currentFocus} style={{ fontWeight: 500 }}>
                  {currentFocus}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Week Strip */}
        {weekDays.length > 0 && (
          <div className="mb-6 bg-card border border-border rounded-lg p-4 shadow-soft sm:p-6">
            <h2 className="mb-4 text-lg font-semibold text-text sm:text-xl" style={{ fontWeight: 700 }}>
              Esta semana
            </h2>
            <WeekStrip
              days={weekDays}
              todayDate={plan.meta.today}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          </div>
        )}

        {/* Main Content: 2-column layout on desktop */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column: Day Detail (2/3 on desktop) */}
          <div className="lg:col-span-2">
            <DayDetail day={selectedDay} />
          </div>

          {/* Right Column: Explanations (1/3 on desktop) */}
          <div className="lg:col-span-1">
            {/* Why This Plan */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-soft sm:p-6">
              <ExplanationList explanations={plan.explanations} />
            </div>

            {/* Link to Weekly Breakdown */}
            <div className="mt-6 bg-card border border-border rounded-lg p-4 shadow-soft sm:p-6">
              <Link
                href={`/results/weekly?${searchParams.toString()}`}
                className="flex w-full items-center justify-center rounded-lg bg-primary hover:bg-[var(--primary-hover)] px-6 py-3 font-semibold text-text shadow-soft transition-colors"
                style={{ fontWeight: 500 }}
              >
                Ver resumen semanal
              </Link>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/calculator"
            className="flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 font-semibold text-text shadow-soft transition-colors hover:bg-bg"
            style={{ fontWeight: 500 }}
          >
            Crear nuevo plan
          </Link>
          <button
            onClick={() => window.print()}
            className="flex items-center justify-center rounded-lg bg-primary hover:bg-[var(--primary-hover)] px-6 py-3 font-semibold text-text shadow-soft transition-colors"
            style={{ fontWeight: 500 }}
          >
            Imprimir plan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg px-4">
          <div className="text-center">
            <div className="mb-2 text-xl font-semibold text-text sm:text-2xl" style={{ fontWeight: 700 }}>Cargando...</div>
            <div className="text-sm text-muted" style={{ fontWeight: 400 }}>Preparando tu plan de estudio</div>
          </div>
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
