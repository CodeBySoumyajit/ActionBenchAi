import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface DeadlineCountdownProps {
  date: string | null | undefined;
  className?: string;
}

export function DeadlineCountdown({ date, className }: DeadlineCountdownProps) {
  if (!date) return <span className="text-xs text-muted-foreground">No deadline</span>;

  const target = new Date(date);
  const now = new Date();
  const daysLeft = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-red-700", className)}>
        <Clock className="h-3 w-3" />
        Overdue
      </span>
    );
  }

  const isUrgent = daysLeft <= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        isUrgent ? "text-red-700" : "text-muted-foreground",
        className
      )}
      data-testid="deadline-countdown"
    >
      <Clock className={cn("h-3 w-3", isUrgent && "animate-pulse")} />
      {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
    </span>
  );
}
