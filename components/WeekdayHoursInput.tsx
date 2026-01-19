"use client";

interface WeekdayHoursInputProps {
  value: number[];
  onChange: (value: number[]) => void;
  error?: string;
}

const WEEKDAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export function WeekdayHoursInput({ value, onChange, error }: WeekdayHoursInputProps) {
  const handleChange = (index: number, hours: string) => {
    const numValue = parseFloat(hours) || 0;
    const newValue = [...value];
    newValue[index] = Math.max(0, numValue);
    onChange(newValue);
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {WEEKDAY_LABELS.map((label, index) => (
          <div key={index}>
            <label className="mb-1.5 block text-sm font-medium text-text" style={{ fontWeight: 500 }}>{label}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="0.25"
                value={value[index] || 0}
                onChange={(e) => handleChange(index, e.target.value)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 pr-12 text-base text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-0"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">h</span>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-accent" style={{ fontWeight: 500 }}>{error}</p>}
    </div>
  );
}
