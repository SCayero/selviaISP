interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "success" | "info";
  size?: "sm" | "md";
}

export function Badge({ children, variant = "primary", size = "md" }: BadgeProps) {
  const variantClasses = {
    primary: "bg-indigo-100 text-indigo-800",
    secondary: "bg-gray-100 text-gray-800",
    success: "bg-emerald-100 text-emerald-800",
    info: "bg-blue-100 text-blue-800",
  };

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${variantClasses[variant]} ${sizeClasses[size]}`}
    >
      {children}
    </span>
  );
}
