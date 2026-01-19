import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4">
      <main className="w-full max-w-6xl mx-auto text-center">
        <h1 className="mb-6 text-5xl font-bold text-text md:text-6xl" style={{ fontWeight: 700 }}>
          Selvia
        </h1>
        <h2 className="mb-8 text-2xl font-semibold text-text md:text-3xl" style={{ fontWeight: 700 }}>
          Ideal Study Path (ISP) Calculator
        </h2>
        <p className="mb-12 text-lg text-muted md:text-xl" style={{ fontWeight: 400 }}>
          Calcula tu Plan de Estudio Ideal para las oposiciones de maestro en España
        </p>

        <div className="mb-12 space-y-4">
          <div className="bg-card border border-border rounded-lg p-6 shadow-soft">
            <h3 className="mb-2 text-xl font-semibold text-text" style={{ fontWeight: 700 }}>
              Método Selvia v0
            </h3>
            <p className="text-muted" style={{ fontWeight: 400 }}>
              Genera un plan de estudio personalizado basado en tu disponibilidad,
              experiencia previa y fecha del examen.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="bg-card border border-border rounded-lg p-4 shadow-soft">
              <div className="mb-2 text-2xl">📅</div>
              <h4 className="mb-1 font-semibold text-text" style={{ fontWeight: 700 }}>Planificación</h4>
              <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                Optimiza tu tiempo hasta el examen
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 shadow-soft">
              <div className="mb-2 text-2xl">🔄</div>
              <h4 className="mb-1 font-semibold text-text" style={{ fontWeight: 700 }}>Repaso</h4>
              <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                Sistema de repaso espaciado garantizado
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 shadow-soft">
              <div className="mb-2 text-2xl">✅</div>
              <h4 className="mb-1 font-semibold text-text" style={{ fontWeight: 700 }}>Estructurado</h4>
              <p className="text-sm text-muted" style={{ fontWeight: 400 }}>
                Método probado en 4 fases intercaladas
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/calculator"
          className="inline-block rounded-lg bg-primary hover:bg-[var(--primary-hover)] text-text px-8 py-4 text-lg font-semibold shadow-soft transition-colors"
          style={{ fontWeight: 700 }}
        >
          Crear mi Plan de Estudio
        </Link>

        <div className="mt-8">
          <Link
            href="/debug/engine"
            className="text-xs text-muted hover:text-primary hover:underline"
            style={{ fontWeight: 400 }}
          >
            Debug engine →
          </Link>
        </div>
      </main>
    </div>
  );
}
