interface ExplanationListProps {
  explanations: string[];
}

export function ExplanationList({ explanations }: ExplanationListProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold text-text sm:text-xl" style={{ fontWeight: 700 }}>¿Por qué este plan?</h3>
      <ul className="space-y-3">
        {explanations.map((explanation, index) => (
          <li key={index} className="flex items-start">
            <span className="mr-3 mt-1 text-primary">•</span>
            <span className="text-sm leading-relaxed text-text sm:text-base" style={{ fontWeight: 400 }}>{explanation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
