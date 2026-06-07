import { RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
  standalone?: boolean;
}

export function ErrorState({
  message = "Something went wrong while loading data.",
  onRetry,
  className = "",
  standalone = true,
}: ErrorStateProps) {
  const content = (
    <>
      <div className="text-amber-400/70 text-xs mb-1.5">Unable to load</div>
      <p className="text-[#94a3b8] text-sm mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="button inline-flex items-center gap-2 text-xs px-4 py-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Try again
        </button>
      )}
    </>
  );

  if (standalone) {
    return (
      <div className={`card p-6 text-center ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`py-6 text-center ${className}`}>
      {content}
    </div>
  );
}
