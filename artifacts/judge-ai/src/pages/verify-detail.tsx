import { useState } from "react";
import { useGetVerifyDetail, getGetVerifyDetailQueryKey, useApproveJudgment, useEditJudgment, useRejectJudgment, getGetVerifyQueueQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { PriorityBadge } from "@/components/priority-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { CheckCircle, Edit, XCircle, AlertTriangle, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface VerifyDetailProps { id: number; }

function EditableField({ label, value, onSave, confidence }: { label: string; value: string | null | undefined; onSave?: (v: string) => void; confidence?: number | null; }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value ?? "");
  const isLowConf = confidence != null && confidence < 0.6;
  const isMedConf = confidence != null && confidence >= 0.6 && confidence < 0.85;

  if (editing && onSave) {
    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => { onSave(val); setEditing(false); }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div
      className={cn("rounded p-2 cursor-pointer hover:bg-gray-50 transition-colors group border", isLowConf ? "border-red-200 bg-red-50" : isMedConf ? "border-yellow-200 bg-yellow-50/40" : "border-transparent")}
      onClick={() => onSave && setEditing(true)}
    >
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1.5">
          {isLowConf && <AlertTriangle className="h-3 w-3 text-red-500" />}
          {confidence != null && <ConfidenceBadge score={confidence} />}
        </div>
      </div>
      <p className={cn("text-sm font-medium", !value && "text-muted-foreground italic")}>{value || "Not extracted"}</p>
    </div>
  );
}

export default function VerifyDetail({ id }: VerifyDetailProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useGetVerifyDetail(id, {
    query: { enabled: !!id, queryKey: getGetVerifyDetailQueryKey(id) },
  });

  const [editedExt, setEditedExt] = useState<Record<string, unknown>>({});
  const [editedAP, setEditedAP] = useState<Record<string, unknown>>({});
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [confirmAction, setConfirmAction] = useState<"approve" | "edit" | "reject" | null>(null);

  const approveMut = useApproveJudgment();
  const editMut = useEditJudgment();
  const rejectMut = useRejectJudgment();

  const judgment = data?.judgment;
  const extraction = data?.extraction;
  const actionPlan = data?.actionPlan;
  const token = localStorage.getItem("jwt_token");
  const pdfUrl = data?.pdfUrl ? `${data.pdfUrl}?token=${token}` : null;

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetVerifyQueueQueryKey() });
    setLocation("/verify");
  }

  function handleConfirm() {
    if (!confirmAction) return;
    if (confirmAction === "approve") {
      approveMut.mutate(
        { judgmentId: id },
        {
          onSuccess: () => { toast({ title: "Judgment approved" }); invalidate(); },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    } else if (confirmAction === "edit") {
      const mergedExt = { ...(extraction ?? {}), ...editedExt };
      const mergedAP = { ...(actionPlan ?? {}), ...editedAP };
      editMut.mutate(
        { judgmentId: id, data: { editedExtraction: mergedExt, editedActionPlan: mergedAP, reviewerNotes: reviewerNotes || undefined } },
        {
          onSuccess: () => { toast({ title: "Judgment approved with edits" }); invalidate(); },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    } else {
      if (!reviewerNotes.trim()) { toast({ title: "Reviewer notes required for rejection", variant: "destructive" }); setConfirmAction(null); return; }
      rejectMut.mutate(
        { judgmentId: id, data: { reviewerNotes } },
        {
          onSuccess: () => { toast({ title: "Judgment rejected" }); invalidate(); },
          onError: () => toast({ title: "Error", variant: "destructive" }),
        }
      );
    }
    setConfirmAction(null);
  }

  function setExtField(key: string, value: string) {
    setEditedExt(prev => ({ ...prev, [key]: value }));
  }

  function getExtValue(key: string): string | null | undefined {
    return (editedExt[key] as string | undefined) ?? (extraction as Record<string, unknown> | undefined)?.[key] as string | undefined;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-2 gap-6">
            <Skeleton className="h-[600px]" />
            <Skeleton className="h-[600px]" />
          </div>
        </div>
      </div>
    );
  }

  if (!data || !judgment) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground">Judgment not found or not ready for review.</p>
          <Link href="/verify" className="text-[#1a3c6e] hover:underline text-sm mt-4 inline-block">Back to Queue</Link>
        </div>
      </div>
    );
  }

  const isBusy = approveMut.isPending || editMut.isPending || rejectMut.isPending;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/verify" className="text-muted-foreground hover:text-foreground">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-bold text-foreground text-base">{judgment.caseNumber ?? "Judgment Review"}</h1>
              <p className="text-xs text-muted-foreground">{judgment.courtName} · AI Confidence: <ConfidenceBadge score={extraction?.aiConfidenceScore} /></p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="destructive" onClick={() => setConfirmAction("reject")} disabled={isBusy} data-testid="button-reject">
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setConfirmAction("edit")} disabled={isBusy} data-testid="button-approve-edit">
              <Edit className="h-4 w-4 mr-1" /> Approve with Edits
            </Button>
            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => setConfirmAction("approve")} disabled={isBusy} data-testid="button-approve">
              <CheckCircle className="h-4 w-4 mr-1" /> Approve
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden" style={{ height: "calc(100vh - 110px)" }}>
          {/* Left: PDF Viewer */}
          <div className="border-r bg-gray-100 flex flex-col">
            <div className="px-4 py-2 bg-gray-200 border-b text-xs font-medium text-gray-600">PDF Document</div>
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="flex-1 w-full"
                title="Judgment PDF"
                data-testid="pdf-viewer"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">PDF not available</div>
            )}
          </div>

          {/* Right: Review Panel */}
          <div className="flex flex-col overflow-hidden">
            <Tabs defaultValue="extraction" className="flex flex-col h-full">
              <TabsList className="mx-4 mt-3 mb-0 shrink-0">
                <TabsTrigger value="extraction">Extracted Data</TabsTrigger>
                <TabsTrigger value="actionplan">Action Plan</TabsTrigger>
                <TabsTrigger value="notes">Review Notes</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                <TabsContent value="extraction" className="mt-0 space-y-2">
                  <EditableField label="Case Title" value={getExtValue("caseTitle")} onSave={v => setExtField("caseTitle", v)} />
                  <EditableField label="Case Number" value={getExtValue("caseNumber")} onSave={v => setExtField("caseNumber", v)} />
                  <EditableField label="Court Name" value={getExtValue("courtName")} onSave={v => setExtField("courtName", v)} />
                  <EditableField
                    label="Date of Order"
                    value={getExtValue("dateOfOrder")}
                    onSave={v => setExtField("dateOfOrder", v)}
                    confidence={extraction?.dateOfOrder ? 0.9 : 0.3}
                  />
                  <EditableField label="Petitioner" value={getExtValue("petitionerName")} onSave={v => setExtField("petitionerName", v)} />
                  <EditableField label="Petitioner Advocate" value={getExtValue("petitionerAdvocate")} onSave={v => setExtField("petitionerAdvocate", v)} />
                  <EditableField label="Respondent" value={getExtValue("respondentName")} onSave={v => setExtField("respondentName", v)} />
                  <EditableField label="Respondent Advocate" value={getExtValue("respondentAdvocate")} onSave={v => setExtField("respondentAdvocate", v)} />
                  <div className="rounded p-2 border border-transparent">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Summary</p>
                    <p className="text-sm">{extraction?.summaryText || "Not available"}</p>
                  </div>
                  {extraction?.relevantActs && extraction.relevantActs.length > 0 && (
                    <div className="rounded p-2 border border-transparent">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Relevant Acts</p>
                      <div className="flex flex-wrap gap-1">
                        {extraction.relevantActs.map((act, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{act}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {extraction?.keyDirections && extraction.keyDirections.length > 0 && (
                    <div className="rounded p-2 border border-transparent">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Key Directions ({extraction.keyDirections.length})</p>
                      <div className="space-y-2">
                        {(extraction.keyDirections as Array<Record<string, unknown>>).map((d, i) => (
                          <div key={i} className={cn("text-xs p-2 rounded border", (d.confidenceScore as number) < 0.6 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200")}>
                            <p>{String(d.directive ?? "")}</p>
                            {d.confidenceScore != null && <ConfidenceBadge score={d.confidenceScore as number} className="mt-1" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="actionplan" className="mt-0 space-y-3">
                  {actionPlan ? (
                    <>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded border">
                        <span className="text-sm font-medium">Priority Level</span>
                        <PriorityBadge level={actionPlan.priorityLevel} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className={cn("p-3 rounded border text-sm", actionPlan.complianceRequired ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200")}>
                          <p className="text-xs text-muted-foreground mb-1">Compliance</p>
                          <p className="font-semibold">{actionPlan.complianceRequired ? "Required" : "Not Required"}</p>
                        </div>
                        <div className={cn("p-3 rounded border text-sm", actionPlan.appealConsideration ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200")}>
                          <p className="text-xs text-muted-foreground mb-1">Appeal</p>
                          <p className="font-semibold">{actionPlan.appealConsideration ? "Under Consideration" : "Not Applicable"}</p>
                        </div>
                      </div>
                      {actionPlan.appealDeadline && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm">
                          <p className="text-xs text-muted-foreground mb-1">Appeal Deadline</p>
                          <p className="font-semibold text-red-700">{actionPlan.appealDeadline}</p>
                        </div>
                      )}
                      {actionPlan.aiRationale && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                          <p className="text-xs text-muted-foreground mb-1">AI Rationale</p>
                          <p className="text-blue-800">{actionPlan.aiRationale}</p>
                        </div>
                      )}
                      {Array.isArray(actionPlan.actionItems) && actionPlan.actionItems.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Action Items ({actionPlan.actionItems.length})</p>
                          <div className="space-y-2">
                            {(actionPlan.actionItems as Array<Record<string, unknown>>).map((item, i) => (
                              <div key={i} className="p-3 bg-white border rounded text-xs space-y-1" data-testid={`action-item-${i}`}>
                                <p className="font-medium text-sm">{String(item.action ?? "")}</p>
                                <div className="flex flex-wrap gap-2 text-muted-foreground">
                                  {Boolean(item.owner) && <span>Owner: {String(item.owner)}</span>}
                                  {Boolean(item.dueDate) && <span>Due: {String(item.dueDate)}</span>}
                                  {Boolean(item.urgency) && (
                                    <Badge variant={item.urgency === "HIGH" ? "destructive" : "secondary"} className="text-xs">
                                      {String(item.urgency)}
                                    </Badge>
                                  )}
                                  {Boolean(item.isInferred) && <Badge variant="outline" className="text-xs">Inferred</Badge>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-8">Action plan not available</p>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="mt-0">
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Add reviewer notes. Notes are required when rejecting.</p>
                    <Textarea
                      value={reviewerNotes}
                      onChange={e => setReviewerNotes(e.target.value)}
                      placeholder="Enter your review notes here..."
                      className="min-h-[200px]"
                      data-testid="textarea-reviewer-notes"
                    />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approve" ? "Approve Judgment" : confirmAction === "edit" ? "Approve with Edits" : "Reject Judgment"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction === "approve" && "This will mark the judgment as verified and publish it to the dashboard."}
              {confirmAction === "edit" && "Your inline edits will be saved and the judgment will be marked as verified."}
              {confirmAction === "reject" && "This judgment will be marked as rejected. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={confirmAction === "reject" ? "bg-red-600 hover:bg-red-700" : confirmAction === "edit" ? "bg-blue-600 hover:bg-blue-700" : "bg-green-600 hover:bg-green-700"}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
