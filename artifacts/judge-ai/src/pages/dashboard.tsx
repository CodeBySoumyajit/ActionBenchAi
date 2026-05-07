import { useState } from "react";
import { useGetDashboardEntries, getGetDashboardEntriesQueryKey, useGetDashboardStats, getGetDashboardStatsQueryKey, useGetDashboardEntry, getGetDashboardEntryQueryKey, useUpdateDashboardEntryStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { PriorityBadge } from "@/components/priority-badge";
import { DeadlineCountdown } from "@/components/deadline-countdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { LayoutDashboard, Search, Filter, BarChart2, TableIcon, Clock, AlertTriangle, CheckCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#f59e0b",
  LOW: "#16a34a",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-800" },
  COMPLIED: { label: "Complied", className: "bg-green-100 text-green-800" },
  APPEALED: { label: "Appealed", className: "bg-purple-100 text-purple-800" },
  CLOSED: { label: "Closed", className: "bg-gray-100 text-gray-600" },
};

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent?: string }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", accent ?? "bg-[#1a3c6e]/10")}>
          <Icon className={cn("h-5 w-5", accent ? "text-white" : "text-[#1a3c6e]")} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EntrySlideOver({ entryId, onClose }: { entryId: number; onClose: () => void }) {
  const { data: entry } = useGetDashboardEntry(entryId, {
    query: { enabled: !!entryId, queryKey: getGetDashboardEntryQueryKey(entryId) },
  });
  const updateStatus = useUpdateDashboardEntryStatus();
  const qc = useQueryClient();
  const { toast } = useToast();

  function handleStatusChange(status: string) {
    updateStatus.mutate(
      { id: entryId, data: { status: status as "ACTIVE" | "COMPLIED" | "APPEALED" | "CLOSED" } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetDashboardEntriesQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          qc.invalidateQueries({ queryKey: getGetDashboardEntryQueryKey(entryId) });
          toast({ title: "Status updated" });
        },
      }
    );
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {entry?.caseNumber ?? "Case Details"}
          </SheetTitle>
        </SheetHeader>
        {!entry ? (
          <div className="space-y-3 mt-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <PriorityBadge level={entry.priorityLevel} />
              <Badge className={cn("text-xs", STATUS_CONFIG[entry.status]?.className)}>{STATUS_CONFIG[entry.status]?.label ?? entry.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted-foreground">Court</p><p className="font-medium">{entry.courtName ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Date of Order</p><p className="font-medium">{entry.dateOfOrder ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Department</p><p className="font-medium">{entry.department ?? "—"}</p></div>
              <div><p className="text-xs text-muted-foreground">Compliance</p><p className={cn("font-semibold", entry.complianceRequired ? "text-amber-700" : "text-green-700")}>{entry.complianceRequired ? "Required" : "Not Required"}</p></div>
            </div>

            {entry.caseTitle && (
              <div className="p-3 bg-gray-50 rounded border text-sm">
                <p className="text-xs text-muted-foreground mb-1">Case Title</p>
                <p className="font-medium">{entry.caseTitle}</p>
              </div>
            )}

            {entry.appealConsidering && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                <p className="text-xs text-blue-600 font-semibold mb-1">Appeal Under Consideration</p>
                {entry.appealDeadline && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    <span>Deadline: {entry.appealDeadline}</span>
                    <DeadlineCountdown date={entry.appealDeadline} />
                  </div>
                )}
              </div>
            )}

            {Array.isArray(entry.keyActions) && entry.keyActions.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Action Items</p>
                <div className="space-y-2">
                  {(entry.keyActions as Array<Record<string, unknown>>).map((a, i) => (
                    <div key={i} className="p-2.5 bg-white border rounded text-xs">
                      <p className="font-medium text-sm">{String(a.action ?? "")}</p>
                      <div className="flex gap-2 mt-1 text-muted-foreground">
                        {Boolean(a.owner) && <span>Owner: {String(a.owner)}</span>}
                        {Boolean(a.dueDate) && <span>Due: {String(a.dueDate)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Update Status</p>
              <Select value={entry.status} onValueChange={handleStatusChange}>
                <SelectTrigger data-testid="select-entry-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLIED">Complied</SelectItem>
                  <SelectItem value="APPEALED">Appealed</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function Dashboard() {
  const [filters, setFilters] = useState({ department: "", priority: "", status: "", search: "", page: 1 });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const queryParams = {
    ...(filters.department && { department: filters.department }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.status && { status: filters.status }),
    ...(filters.search && { search: filters.search }),
    page: filters.page,
    limit: 50,
  };

  const { data: entriesData, isLoading: loadingEntries } = useGetDashboardEntries(queryParams, {
    query: { queryKey: getGetDashboardEntriesQueryKey(queryParams) },
  });

  const { data: stats } = useGetDashboardStats({
    query: { queryKey: getGetDashboardStatsQueryKey(), refetchInterval: 30000 },
  });

  const entries = entriesData?.entries ?? [];

  const barData = stats ? Object.entries(stats.byDepartment as Record<string, number>).map(([name, count]) => ({ name: name.length > 15 ? name.slice(0, 15) + "…" : name, count })) : [];
  const pieData = stats ? Object.entries(stats.byPriority as Record<string, number>).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })) : [];

  function clearFilter(key: keyof typeof filters) {
    setFilters(f => ({ ...f, [key]: "", page: 1 }));
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Cases" value={stats?.total ?? 0} icon={FileText} />
          <StatCard label="Pending Verification" value={stats?.pendingVerification ?? 0} icon={Clock} />
          <StatCard label="High/Critical" value={(stats?.byPriority as Record<string, number> | undefined)?.HIGH ?? 0 + ((stats?.byPriority as Record<string, number> | undefined)?.CRITICAL ?? 0)} icon={AlertTriangle} />
          <StatCard label="Upcoming Deadlines" value={stats?.upcomingDeadlines?.length ?? 0} icon={CheckCircle} />
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search cases..."
                  className="pl-9"
                  value={filters.search}
                  onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
                  data-testid="input-search"
                />
              </div>
              <Select value={filters.priority || "all"} onValueChange={v => setFilters(f => ({ ...f, priority: v === "all" ? "" : v, page: 1 }))}>
                <SelectTrigger className="w-36" data-testid="select-priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="CRITICAL">Critical</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status || "all"} onValueChange={v => setFilters(f => ({ ...f, status: v === "all" ? "" : v, page: 1 }))}>
                <SelectTrigger className="w-36" data-testid="select-status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="COMPLIED">Complied</SelectItem>
                  <SelectItem value="APPEALED">Appealed</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex rounded border overflow-hidden">
                <button onClick={() => setViewMode("table")} className={cn("px-3 py-1.5 text-sm transition-colors", viewMode === "table" ? "bg-[#1a3c6e] text-white" : "hover:bg-gray-100")} data-testid="button-table-view">
                  <TableIcon className="h-4 w-4" />
                </button>
                <button onClick={() => setViewMode("cards")} className={cn("px-3 py-1.5 text-sm transition-colors", viewMode === "cards" ? "bg-[#1a3c6e] text-white" : "hover:bg-gray-100")} data-testid="button-card-view">
                  <BarChart2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table View */}
        {viewMode === "table" && (
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="dashboard-table">
                <thead>
                  <tr className="bg-[#1a3c6e] text-white text-xs uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-semibold">Priority</th>
                    <th className="text-left px-4 py-3 font-semibold">Case No.</th>
                    <th className="text-left px-4 py-3 font-semibold">Case Title</th>
                    <th className="text-left px-4 py-3 font-semibold">Court</th>
                    <th className="text-left px-4 py-3 font-semibold">Department</th>
                    <th className="text-left px-4 py-3 font-semibold">Deadline</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEntries ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  ) : entries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">No dashboard entries yet</td>
                    </tr>
                  ) : (
                    entries.map((e, idx) => (
                      <tr
                        key={e.id}
                        onClick={() => setSelectedId(e.id)}
                        className={cn("border-b hover:bg-blue-50 cursor-pointer transition-colors", idx % 2 === 0 ? "bg-white" : "bg-gray-50/60")}
                        data-testid={`row-entry-${e.id}`}
                      >
                        <td className="px-4 py-3"><PriorityBadge level={e.priorityLevel} /></td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-[#1a3c6e]">{e.caseNumber ?? "—"}</td>
                        <td className="px-4 py-3 max-w-xs"><span className="line-clamp-2">{e.caseTitle ?? "—"}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{e.courtName ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{e.department ?? "—"}</td>
                        <td className="px-4 py-3"><DeadlineCountdown date={e.appealDeadline} /></td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", STATUS_CONFIG[e.status]?.className)}>
                            {STATUS_CONFIG[e.status]?.label ?? e.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Card View */}
        {viewMode === "cards" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loadingEntries ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)
            ) : entries.length === 0 ? (
              <div className="col-span-3 text-center py-12 text-muted-foreground">No dashboard entries yet</div>
            ) : (
              entries.map(e => (
                <Card
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200"
                  data-testid={`card-entry-${e.id}`}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <PriorityBadge level={e.priorityLevel} />
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium", STATUS_CONFIG[e.status]?.className)}>{STATUS_CONFIG[e.status]?.label}</span>
                    </div>
                    <div>
                      <p className="font-bold text-sm text-[#1a3c6e]">{e.caseNumber ?? "No case number"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{e.caseTitle ?? "Untitled"}</p>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {e.courtName && <div className="flex items-center gap-1"><FileText className="h-3 w-3" />{e.courtName}</div>}
                      {e.department && <div>{e.department}</div>}
                    </div>
                    <div className="pt-2 border-t flex items-center justify-between">
                      <span className={cn("text-xs font-medium", e.complianceRequired ? "text-amber-700" : "text-green-700")}>
                        {e.complianceRequired ? "Compliance Required" : "No Compliance Required"}
                      </span>
                      <DeadlineCountdown date={e.appealDeadline} />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* Charts */}
        {stats && (barData.length > 0 || pieData.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {barData.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Cases by Department</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={barData} margin={{ left: -10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1a3c6e" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            {pieData.length > 0 && (
              <Card className="border-0 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Priority Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? "#8884d8"} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Upcoming Deadlines */}
        {stats && stats.upcomingDeadlines.length > 0 && (
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                Upcoming Deadlines (Next 30 Days)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(stats.upcomingDeadlines as Array<Record<string, unknown>>).map((d, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded text-sm">
                    <div>
                      <span className="font-medium">{String(d.caseNumber ?? "—")}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{String(d.caseTitle ?? "")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <PriorityBadge level={String(d.priorityLevel ?? "MEDIUM")} />
                      <DeadlineCountdown date={String(d.deadline ?? "")} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {selectedId && <EntrySlideOver entryId={selectedId} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
