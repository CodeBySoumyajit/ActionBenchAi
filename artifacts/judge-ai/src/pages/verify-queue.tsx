import { useGetVerifyQueue, getGetVerifyQueueQueryKey } from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function VerifyQueue() {
  const { data: queue, isLoading } = useGetVerifyQueue({
    query: { queryKey: getGetVerifyQueueQueryKey(), refetchInterval: 15000 },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-[#1a3c6e]" />
              Verification Queue
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {isLoading ? "Loading..." : `${queue?.length ?? 0} judgment${queue?.length !== 1 ? "s" : ""} awaiting review`}
            </p>
          </div>
        </div>

        <Card className="border-0 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="verify-queue-table">
              <thead>
                <tr className="bg-[#1a3c6e] text-white text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3 font-semibold">Case No.</th>
                  <th className="text-left px-4 py-3 font-semibold">Case Title</th>
                  <th className="text-left px-4 py-3 font-semibold">Court</th>
                  <th className="text-left px-4 py-3 font-semibold">Uploaded</th>
                  <th className="text-left px-4 py-3 font-semibold">Uploaded By</th>
                  <th className="text-left px-4 py-3 font-semibold">AI Confidence</th>
                  <th className="text-left px-4 py-3 font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !queue || queue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No judgments pending verification
                    </td>
                  </tr>
                ) : (
                  queue.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={cn("border-b hover:bg-blue-50 transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/60")}
                      data-testid={`row-judgment-${item.id}`}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium text-[#1a3c6e]">
                        {item.caseNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="line-clamp-2 text-sm">{item.caseTitle ?? "Untitled"}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.courtName ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {format(new Date(item.uploadedAt), "dd MMM yyyy")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{item.uploadedByName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ConfidenceBadge score={item.aiConfidenceScore} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/verify/${item.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#1a3c6e] hover:underline"
                          data-testid={`link-review-${item.id}`}
                        >
                          Review <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
