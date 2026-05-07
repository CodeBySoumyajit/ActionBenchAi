import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  score: number | null | undefined;
  className?: string;
}

export function ConfidenceBadge({ score, className }: ConfidenceBadgeProps) {
  if (score == null) return <span className="text-xs text-muted-foreground">N/A</span>;

  const pct = Math.round(score * 100);
  const color =
    score > 0.85
      ? "bg-green-100 text-green-800 border-green-200"
      : score >= 0.6
      ? "bg-yellow-100 text-yellow-800 border-yellow-200"
      : "bg-red-100 text-red-800 border-red-200";

  return (
    <span
      className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border", color, className)}
      data-testid="confidence-badge"
    >
      {pct}%
    </span>
  );
}
