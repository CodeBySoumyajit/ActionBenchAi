import { cn } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Info, CheckCircle } from "lucide-react";

const config: Record<string, { label: string; className: string; Icon: React.ElementType }> = {
  CRITICAL: { label: "Critical", className: "bg-red-100 text-red-800 border-red-300", Icon: AlertCircle },
  HIGH: { label: "High", className: "bg-orange-100 text-orange-800 border-orange-300", Icon: AlertTriangle },
  MEDIUM: { label: "Medium", className: "bg-yellow-100 text-yellow-800 border-yellow-300", Icon: Info },
  LOW: { label: "Low", className: "bg-green-100 text-green-800 border-green-200", Icon: CheckCircle },
};

interface PriorityBadgeProps {
  level: string;
  className?: string;
}

export function PriorityBadge({ level, className }: PriorityBadgeProps) {
  const c = config[level] ?? config.MEDIUM;
  const Icon = c.Icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border", c.className, className)}
      data-testid="priority-badge"
    >
      <Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}
