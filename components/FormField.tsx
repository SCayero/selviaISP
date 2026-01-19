import { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function FormField({ label, required = false, error, children }: FormFieldProps) {
  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-semibold text-text" style={{ fontWeight: 700 }}>
        {label}
        {required && <span className="ml-1 text-accent">*</span>}
      </label>
      {children}
      {error && <p className="mt-2 text-sm font-medium text-accent" style={{ fontWeight: 500 }}>{error}</p>}
    </div>
  );
}
