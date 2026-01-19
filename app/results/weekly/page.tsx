"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Plan, FormInputs } from "@/lib/engine/types";
import { generatePlan } from "@/lib/engine/generator";
import { WeekSummaryRow } from "@/components/WeekSummaryRow";
import { diffDays, formatDate } from "@/lib/utils/date";

function WeeklyBreakdownContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <div className="mb-2 text-2xl font-semibold text-text sm:text-3xl" style={{ fontWeight: 700 }}>
            Cargando...
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

  // Calculate summary statistics
  const daysUntilExam = diffDays(plan.meta.today, plan.meta.examDate);
  const weeklyHours = plan.days.reduce((sum, day) => sum + day.totalHours, 0) / Math.ceil(daysUntilExam / 7);

  return (
    <div className="min-h-screen bg-bg px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="mb-6 rounded-lg border border-border bg-primary p-4 shadow-soft sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>
                Resumen Semanal
              </h1>
              <div className="text-xs text-muted sm:text-sm lg:text-base" style={{ fontWeight: 400 }}>
                {formatDate(plan.meta.examDate)} • {plan.meta.region} • {plan.meta.stage}
              </div>
            </div>
            <Link
              href={`/results?${searchParams.toString()}`}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-text shadow-soft transition-colors hover:bg-bg sm:px-6 sm:py-3"
              style={{ fontWeight: 500 }}
            >
              ← Volver
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 lg:gap-6">
            <div className="text-center">
              <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Días</div>
              <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{daysUntilExam}</div>
            </div>
            <div className="text-center">
              <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Horas/sem</div>
              <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{weeklyHours.toFixed(1)}</div>
            </div>
            <div className="text-center">
              <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Unidades</div>
              <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{plan.meta.unitsTotal}</div>
            </div>
            <div className="col-span-2 text-center sm:col-span-1">
              <div className="mb-1 text-xs font-medium text-muted sm:text-sm" style={{ fontWeight: 500 }}>Semanas</div>
              <div className="text-xl font-bold text-text sm:text-2xl lg:text-3xl" style={{ fontWeight: 700 }}>{plan.weeklySummaries.length}</div>
            </div>
          </div>
        </div>

        {/* Weeks Overview */}
        <div className="bg-card border border-border rounded-lg p-4 shadow-soft sm:p-6">
          <h2 className="mb-4 text-xl font-semibold text-text sm:text-2xl" style={{ fontWeight: 700 }}>
            Resumen por semanas
          </h2>
          <div className="divide-y divide-border">
            {plan.weeklySummaries.map((summary, index) => (
              <WeekSummaryRow key={index} summary={summary} />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={`/results?${searchParams.toString()}`}
            className="flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 font-semibold text-text shadow-soft transition-colors hover:bg-bg"
            style={{ fontWeight: 500 }}
          >
            ← Volver al plan detallado
          </Link>
          <Link
            href="/calculator"
            className="flex items-center justify-center rounded-lg border border-border bg-card px-6 py-3 font-semibold text-text shadow-soft transition-colors hover:bg-bg"
            style={{ fontWeight: 500 }}
          >
            Crear nuevo plan
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function WeeklyBreakdownPage() {
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
      <WeeklyBreakdownContent />
    </Suspense>
  );
}
