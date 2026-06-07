interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
  standalone?: boolean;
}

export function EmptyState({
  title = "No data available",
  description = "There's nothing to show right now.",
  className = "",
  standalone = true,
}: EmptyStateProps) {
  const content = (
    <>
      <div className="text-[#64748b] text-sm">{title}</div>
      {description && <p className="text-[#475569] text-xs mt-1">{description}</p>}
    </>
  );

  if (standalone) {
    return <div className={`card p-6 text-center ${className}`}>{content}</div>;
  }

  return <div className={`py-6 text-center ${className}`}>{content}</div>;
}
