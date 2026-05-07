import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = [
  { key: "PENDING", label: "Uploaded" },
  { key: "PROCESSING", label: "Processing" },
  { key: "EXTRACTED", label: "Extracted" },
  { key: "VERIFIED", label: "Verified" },
];

const STEP_ORDER = ["PENDING", "PROCESSING", "EXTRACTED", "VERIFIED", "REJECTED", "EXTRACTION_FAILED"];

interface StatusTimelineProps {
  current: string;
  className?: string;
}

export function StatusTimeline({ current, className }: StatusTimelineProps) {
  const currentIdx = STEP_ORDER.indexOf(current);
  const isFailed = current === "EXTRACTION_FAILED" || current === "REJECTED";

  return (
    <div className={cn("flex items-center gap-0", className)} data-testid="status-timeline">
      {STEPS.map((step, i) => {
        const stepIdx = STEP_ORDER.indexOf(step.key);
        const isDone = !isFailed && currentIdx > stepIdx;
        const isActive = !isFailed && current === step.key;
        const isCurrent = isFailed && i === STEPS.findIndex(s => s.key === "EXTRACTED");

        return (
          <div key={step.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  isDone ? "bg-[#1a3c6e] border-[#1a3c6e] text-white" :
                  isActive ? "bg-amber-500 border-amber-500 text-white" :
                  isFailed && i >= 2 ? "bg-red-100 border-red-400 text-red-600" :
                  "bg-white border-gray-300 text-gray-400"
                )}
              >
                {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn(
                "text-xs mt-1 whitespace-nowrap",
                isActive ? "text-amber-600 font-semibold" : isDone ? "text-[#1a3c6e]" : "text-gray-400"
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "h-0.5 w-10 mb-4",
                isDone ? "bg-[#1a3c6e]" : "bg-gray-200"
              )} />
            )}
          </div>
        );
      })}
      {isFailed && (
        <div className="ml-3 flex items-center gap-1 text-xs text-red-600 font-medium">
          <span className="w-2 h-2 bg-red-500 rounded-full"></span>
          {current === "EXTRACTION_FAILED" ? "Extraction Failed" : "Rejected"}
        </div>
      )}
    </div>
  );
}
