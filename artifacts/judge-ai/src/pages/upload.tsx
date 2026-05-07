import { useState, useCallback, useRef } from "react";
import { useGetJudgment, getGetJudgmentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Navbar } from "@/components/navbar";
import { StatusTimeline } from "@/components/status-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Upload as UploadIcon, FileText, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Uploading & queued...",
  PROCESSING: "Running AI Analysis...",
  EXTRACTED: "Ready for Review",
  EXTRACTION_FAILED: "Extraction Failed",
};

const STATUS_PROGRESS: Record<string, number> = {
  PENDING: 25,
  PROCESSING: 65,
  EXTRACTED: 100,
  EXTRACTION_FAILED: 100,
};

function UploadedJudgmentStatus({ judgmentId }: { judgmentId: number }) {
  const { data: detail } = useGetJudgment(judgmentId, {
    query: {
      enabled: true,
      queryKey: getGetJudgmentQueryKey(judgmentId),
      refetchInterval: (query) => {
        const status = (query.state.data as { judgment?: { status?: string } } | undefined)?.judgment?.status;
        return status === "EXTRACTED" || status === "EXTRACTION_FAILED" ? false : 3000;
      },
    },
  });

  const judgment = detail?.judgment;
  const status = judgment?.status ?? "PENDING";
  const isFailed = status === "EXTRACTION_FAILED";
  const isDone = status === "EXTRACTED";

  return (
    <Card className="mt-6 border-0 shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isDone ? <CheckCircle className="h-5 w-5 text-green-600" /> : isFailed ? <AlertCircle className="h-5 w-5 text-red-500" /> : <FileText className="h-5 w-5 text-[#1a3c6e]" />}
          Processing Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <StatusTimeline current={status} />
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className={cn(isFailed ? "text-red-600" : isDone ? "text-green-700 font-medium" : "text-[#1a3c6e]")}>
              {STATUS_LABELS[status] ?? status}
            </span>
            <span className="text-muted-foreground">{STATUS_PROGRESS[status] ?? 0}%</span>
          </div>
          <Progress value={STATUS_PROGRESS[status] ?? 0} className={cn("h-2", isFailed && "[&>div]:bg-red-500", isDone && "[&>div]:bg-green-600")} />
        </div>
        {isFailed && (
          <p className="text-sm text-red-600 bg-red-50 rounded p-3">
            AI extraction failed. Please check the PDF quality and retry.
          </p>
        )}
        {isDone && (
          <p className="text-sm text-green-700 bg-green-50 rounded p-3">
            Extraction complete. The judgment is now in the verification queue.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function Upload() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [caseNumber, setCaseNumber] = useState("");
  const [courtName, setCourtName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedId, setUploadedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const token = localStorage.getItem("jwt_token");

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Only PDF files are allowed", variant: "destructive" });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 50MB", variant: "destructive" });
      return;
    }
    setFile(f);
    setUploadedId(null);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (caseNumber) formData.append("caseNumber", caseNumber);
      if (courtName) formData.append("courtName", courtName);

      const res = await fetch("/api/judgments/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const data = await res.json();
      setUploadedId(data.id);
      toast({ title: "Uploaded successfully", description: "AI processing has started" });
      setFile(null);
      setCaseNumber("");
      setCourtName("");
    } catch (err) {
      toast({ title: "Upload failed", description: String(err), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Upload Court Judgment</h1>
          <p className="text-muted-foreground mt-1 text-sm">Upload a PDF of a court judgment for AI-powered extraction and analysis.</p>
        </div>

        <Card className="border-0 shadow-md">
          <CardContent className="p-6 space-y-5">
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
                dragOver ? "border-[#1a3c6e] bg-blue-50" : file ? "border-green-400 bg-green-50" : "border-gray-300 hover:border-[#1a3c6e] hover:bg-gray-50"
              )}
              data-testid="upload-dropzone"
            >
              <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium text-green-800 text-sm">{file.name}</p>
                    <p className="text-xs text-green-600">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button className="ml-2 text-gray-400 hover:text-red-500" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <UploadIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-600">Drop a PDF here or click to browse</p>
                  <p className="text-xs text-gray-400 mt-1">Maximum 50MB · PDF only</p>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Case Number (optional)</Label>
                <Input className="mt-1" value={caseNumber} onChange={e => setCaseNumber(e.target.value)} placeholder="e.g. W.P. 1234/2024" data-testid="input-case-number" />
              </div>
              <div>
                <Label>Court Name (optional)</Label>
                <Input className="mt-1" value={courtName} onChange={e => setCourtName(e.target.value)} placeholder="e.g. Karnataka High Court" data-testid="input-court-name" />
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full bg-[#1a3c6e] hover:bg-[#15305a]"
              data-testid="button-upload-submit"
            >
              {uploading ? "Uploading..." : "Upload & Analyze"}
            </Button>
          </CardContent>
        </Card>

        {uploadedId && <UploadedJudgmentStatus judgmentId={uploadedId} />}
      </div>
    </div>
  );
}
