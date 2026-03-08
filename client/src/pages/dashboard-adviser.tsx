import { useState, useRef } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import { FileSearch, History, ClipboardList, Pencil, Check, X, AlertCircle, Upload, Plus, Trash2, FileText, Wrench, PackageCheck, RotateCcw, TruckIcon, Clock, Hourglass, StopCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

function toSentenceCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanComplaintLine(raw: string): string {
  // Remove leading number with optional dot/colon/bracket and spaces: "4 ", "4.", "4)", "4:"
  let cleaned = raw.replace(/^\s*\d+[\s.):]\s*/, "").trim();
  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  // Convert to sentence case if line is fully uppercase
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 2) {
    cleaned = toSentenceCase(cleaned);
  }
  // Normalise "–" spacing around dashes
  cleaned = cleaned.replace(/\s*[-–—]\s*/g, " – ");
  return cleaned.trim();
}

const STOP_SECTION_PATTERNS = [
  /^Inventory/i,
  /^Repair\s+Order/i,
  /^Finance\s+Information/i,
  /^Customer\s+Order\s+Description/i,
  /^Estimated\s+Cost/i,
  /^Estimated\s+Date/i,
  /^Terms\s+of\s+Business/i,
  /^Work\s+Carried\s+Out/i,
  /^Labour/i,
  /^Parts\s+Used/i,
  /^Technician/i,
  /^Advised\s+Repair/i,
  /^Workshop/i,
  /^Foreman/i,
  /^Sl\.?\s*No/i,
  /^Grand\s+Total/i,
  /^Sub\s*Total/i,
  /^VAT/i,
  /^Signature/i,
];

// Patterns that mark lines to skip entirely (not a stop, just noise)
const NOISE_PATTERNS = [
  /^\s*\d+\s*$/, // standalone number
  /^page\s+\d+/i, // page footer
  /^www\./i, // website URL
  /^https?:\/\//i,
  /^\+?\d[\d\s\-().]{6,}$/, // phone number
  /^[A-Z0-9.\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}$/i, // email
];

async function parsePdfComplaints(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as any[];

    const lineMap = new Map<number, string[]>();
    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (!lineMap.has(y)) lineMap.set(y, []);
      lineMap.get(y)!.push(item.str);
    }

    const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
    for (const y of sortedYs) {
      const lineText = lineMap.get(y)!.join("").trim();
      if (lineText) allLines.push(lineText);
    }
  }

  const fullText = allLines.join("\n");
  const marker = "Demanded Repair (Customer Voice)";
  const markerIdx = fullText.indexOf(marker);
  if (markerIdx === -1) throw new Error("SECTION_NOT_FOUND");

  const afterSection = fullText.slice(markerIdx + marker.length);

  const complaints: string[] = [];
  for (const line of afterSection.split("\n")) {
    const trimmed = line.trim();

    // Skip blank lines and noise
    if (!trimmed) continue;
    if (NOISE_PATTERNS.some(p => p.test(trimmed))) continue;

    // Stop at the next section heading
    if (STOP_SECTION_PATTERNS.some(p => p.test(trimmed))) break;

    const cleaned = cleanComplaintLine(trimmed);

    // After cleaning, skip if empty or just punctuation
    if (!cleaned || /^[-–—.:,]+$/.test(cleaned)) continue;
    // Skip very short fragments (likely table headers or stray chars)
    if (cleaned.length < 3) continue;

    complaints.push(cleaned);
  }
  return complaints;
}

export function AdviserDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const { toast } = useToast();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [complaints, setComplaints] = useState<string[]>([]);
  const [serviceNotes, setServiceNotes] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");
  const [pdfFileName, setPdfFileName] = useState("");
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenId, setReopenId] = useState<number | null>(null);
  const [showConfirmDeliver, setShowConfirmDeliver] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  // Inline job card editing state
  const [editingJobCardId, setEditingJobCardId] = useState<number | null>(null);
  const [editingJobCardValue, setEditingJobCardValue] = useState("");
  const [jobCardSaving, setJobCardSaving] = useState(false);
  const [jobCardError, setJobCardError] = useState("");

  const filteredVehicles = vehicles?.filter(v => {
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.jobCardNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || (v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === filterDate);
    return matchesSearch && matchesDate;
  }) || [];

  const WORK_IN_PROGRESS_STATUSES = ["Work in Progress", "Waiting for Technician Approval"];
  const ACTIVE_STATUSES = ["Waiting for Adviser", "Waiting for Job Allocation", "Inspection Completed", ...WORK_IN_PROGRESS_STATUSES, "Job Stopped", "Ready for Delivery", "Reopened", "Delivered"];

  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const pendingInspection    = filteredVehicles.filter(v => v.status === "Waiting for Adviser");
  const waitingAllocation    = filteredVehicles.filter(v => v.status === "Waiting for Job Allocation" || v.status === "Inspection Completed");
  const workInProgress       = filteredVehicles.filter(v => WORK_IN_PROGRESS_STATUSES.includes(v.status));
  const jobStopped           = filteredVehicles.filter(v => v.status === "Job Stopped");
  const pendingFinal         = filteredVehicles.filter(v => v.status === "Ready for Delivery");
  const reopened             = filteredVehicles.filter(v => v.status === "Reopened");
  const delivered            = filteredVehicles.filter(v => v.status === "Delivered");
  const historyVehicles      = filteredVehicles.filter(v => {
    if (!v.createdAt) return false;
    return new Date(v.createdAt) >= currentMonthStart;
  });

  const handleDeliver = (id: number) => {
    updateVehicle.mutate({ id, status: "Delivered" }, {
      onSuccess: () => setShowConfirmDeliver(null)
    });
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("Please upload a valid .pdf file.");
      return;
    }
    setPdfError("");
    setPdfLoading(true);
    setPdfFileName(file.name);
    try {
      const extracted = await parsePdfComplaints(file);
      setComplaints(extracted);
      if (extracted.length === 0) setPdfError("No complaint lines found in the section. You may add them manually.");
    } catch (err: any) {
      if (err.message === "SECTION_NOT_FOUND") {
        setPdfError("Customer complaint section not found in the uploaded PDF. You may add complaints manually.");
        setComplaints([]);
      } else {
        setPdfError("Failed to read PDF. Please try again or add complaints manually.");
        setComplaints([]);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleInspect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const vehicle = vehicles?.find(v => v.id === selectedId);
    const isPostWork = vehicle?.status === "Ready for Delivery";
    updateVehicle.mutate({
      id: selectedId,
      complaints: JSON.stringify(complaints),
      serviceNotes: isPostWork ? (vehicle?.serviceNotes || serviceNotes) : serviceNotes,
      status: isPostWork ? "Delivered" : "Waiting for Job Allocation"
    }, {
      onSuccess: () => {
        setSelectedId(null);
        setComplaints([]);
        setServiceNotes("");
        setPdfError("");
        setPdfFileName("");
        if (pdfInputRef.current) pdfInputRef.current.value = "";
      }
    });
  };

  const handleReopenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenId) return;
    updateVehicle.mutate({ id: reopenId, status: "Reopened", reopenReason }, {
      onSuccess: () => { setReopenId(null); setReopenReason(""); }
    });
  };

  const startEditJobCard = (v: any) => {
    setEditingJobCardId(v.id);
    setEditingJobCardValue(v.jobCardNumber || "");
    setJobCardError("");
  };

  const cancelEditJobCard = () => {
    setEditingJobCardId(null);
    setEditingJobCardValue("");
    setJobCardError("");
  };

  const saveJobCard = async (vehicleId: number) => {
    const value = editingJobCardValue.trim();
    if (!value) { setJobCardError("Job card number cannot be empty."); return; }
    setJobCardSaving(true);
    setJobCardError("");
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobCardNumber: value }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.message || "Failed to save.";
        setJobCardError(msg);
        toast({ variant: "destructive", title: "Duplicate job card", description: msg });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({ title: "Job card updated", description: `Set to: ${value}` });
      setEditingJobCardId(null);
      setEditingJobCardValue("");
    } catch {
      const msg = "Failed to save. Please try again.";
      setJobCardError(msg);
      toast({ variant: "destructive", title: "Error", description: msg });
    } finally {
      setJobCardSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const VehicleCard = ({ v, showAction = true }: { v: any; showAction?: boolean }) => {
    const isEditingThis = editingJobCardId === v.id;

    return (
      <Card className="border border-border/50 shadow-md hover:shadow-xl hover:border-primary/20 transition-all duration-300">
        <CardContent className="p-5 sm:p-6">
          <div className="flex justify-between items-start mb-4 gap-2">
            <div className="min-w-0">
              <h3 className="font-bold text-base sm:text-lg truncate">{v.vehicleModel}</h3>
              <p className="text-sm text-muted-foreground">{v.vehicleNumber}</p>
            </div>
            <StatusBadge status={v.status} />
          </div>

          <div className="bg-muted/50 p-3 rounded-lg text-sm mb-5 space-y-2">
            {/* Editable Job Card Row */}
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground shrink-0">Job Card:</span>
                {!isEditingThis ? (
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium truncate">
                      {v.jobCardNumber || <em className="text-muted-foreground text-xs not-italic">Not assigned</em>}
                    </span>
                    {showAction && (
                      <button
                        onClick={() => startEditJobCard(v)}
                        className="text-muted-foreground hover:text-primary shrink-0 p-0.5 rounded transition-colors"
                        title="Edit job card number"
                        data-testid={`button-edit-jobcard-${v.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-w-0 ml-2">
                    <div className="flex items-center gap-1">
                      <Input
                        value={editingJobCardValue}
                        onChange={e => { setEditingJobCardValue(e.target.value); setJobCardError(""); }}
                        onKeyDown={e => { if (e.key === 'Enter') saveJobCard(v.id); if (e.key === 'Escape') cancelEditJobCard(); }}
                        className="h-7 text-xs px-2"
                        placeholder="Enter job card no."
                        autoFocus
                        data-testid={`input-jobcard-${v.id}`}
                      />
                      <button
                        onClick={() => saveJobCard(v.id)}
                        disabled={jobCardSaving}
                        className="shrink-0 p-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 transition-colors"
                        title="Save"
                        data-testid={`button-save-jobcard-${v.id}`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={cancelEditJobCard}
                        className="shrink-0 p-1 rounded bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                        title="Cancel"
                        data-testid={`button-cancel-jobcard-${v.id}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {jobCardError && (
                      <div className="flex items-center gap-1 mt-1 text-xs text-destructive">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {jobCardError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between"><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{v.customerName}</span></div>
            {v.serviceAdviser && (
              <div className="flex justify-between"><span className="text-muted-foreground">Adviser:</span> <span className="font-medium">{v.serviceAdviser}</span></div>
            )}
            <div className="flex justify-between"><span className="text-muted-foreground">Work Time:</span> <span className="font-medium">{formatDuration(v.totalWorkDuration || 0)}</span></div>
            {v.partsWaitDuration > 0 && (
              <div className="flex justify-between"><span className="text-muted-foreground">Parts Wait:</span> <span className="font-medium text-orange-600">{formatDuration(v.partsWaitDuration)}</span></div>
            )}
            {(v.complaints || v.workDetails || v.reopenReason) && (
              <div className="pt-2 mt-2 border-t border-border/50 space-y-2">
                {v.complaints && (() => {
                  try {
                    const c: string[] = JSON.parse(v.complaints);
                    if (Array.isArray(c) && c.length > 0) return (
                      <div>
                        <span className="text-muted-foreground block text-xs mb-1">Customer Complaints:</span>
                        <ul className="space-y-0.5">
                          {c.slice(0, 3).map((item, i) => (
                            <li key={i} className="flex items-start gap-1 text-xs">
                              <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                              <span className="line-clamp-1">{item}</span>
                            </li>
                          ))}
                          {c.length > 3 && <li className="text-xs text-muted-foreground">+{c.length - 3} more</li>}
                        </ul>
                      </div>
                    );
                  } catch { /* invalid JSON */ }
                  return null;
                })()}
                {v.workDetails && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-1">Work Details:</span>
                    <p className="text-xs line-clamp-2">{v.workDetails}</p>
                  </div>
                )}
                {v.reopenReason && (
                  <div>
                    <span className="text-destructive block text-xs font-bold mb-1">Reopen Reason:</span>
                    <p className="text-xs text-destructive bg-destructive/5 p-1 rounded">{v.reopenReason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {showAction && (
            <div className="flex gap-2">
              {v.status === "Waiting for Adviser" && (
                <Button
                  className="w-full shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/80"
                  onClick={() => setSelectedId(v.id)}
                  data-testid={`button-inspect-${v.id}`}
                >
                  <FileSearch className="w-4 h-4 mr-2" />
                  Perform Inspection
                </Button>
              )}
              {v.status === "Ready for Delivery" && (
                <>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => setShowConfirmDeliver(v.id)} data-testid={`button-deliver-${v.id}`}>
                    Deliver Vehicle
                  </Button>
                  <Button variant="outline" className="flex-1 border-destructive text-destructive" onClick={() => setReopenId(v.id)} data-testid={`button-reopen-${v.id}`}>
                    Reopen Job
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Service Adviser</h2>
        <p className="text-muted-foreground mt-1">Perform initial inspections and log vehicle issues.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Filter by vehicle number, job card or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="w-full md:w-48">
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full" />
        </div>
      </div>

      <Tabs defaultValue="pending-inspection" className="w-full">
        <div className="overflow-x-auto pb-1 mb-6">
          <TabsList className="inline-flex h-auto w-max min-w-full gap-1 p-1.5 bg-muted rounded-xl">
            <TabsTrigger value="pending-inspection" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-pending-inspection">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              Pending Inspection
              {pendingInspection.length > 0 && <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{pendingInspection.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="waiting-allocation" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-waiting-allocation">
              <Hourglass className="w-3.5 h-3.5 shrink-0" />
              Waiting for Job Allocation
              {waitingAllocation.length > 0 && <span className="ml-1 rounded-full bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{waitingAllocation.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="work-in-progress" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-work-in-progress">
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              Work in Progress
              {workInProgress.length > 0 && <span className="ml-1 rounded-full bg-yellow-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{workInProgress.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="job-stopped" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-job-stopped">
              <StopCircle className="w-3.5 h-3.5 shrink-0" />
              Job Stopped
              {jobStopped.length > 0 && <span className="ml-1 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{jobStopped.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="pending-final" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-pending-final">
              <PackageCheck className="w-3.5 h-3.5 shrink-0" />
              Pending Final Inspection
              {pendingFinal.length > 0 && <span className="ml-1 rounded-full bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{pendingFinal.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reopened" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-reopened">
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Reopened
              {reopened.length > 0 && <span className="ml-1 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{reopened.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="delivered" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-delivered">
              <TruckIcon className="w-3.5 h-3.5 shrink-0" />
              Delivered
              {delivered.length > 0 && <span className="ml-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{delivered.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-history">
              <History className="w-3.5 h-3.5 shrink-0" />
              History
              {historyVehicles.length > 0 && <span className="ml-1 rounded-full bg-muted-foreground/50 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{historyVehicles.length}</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Pending Inspection */}
        <TabsContent value="pending-inspection" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Vehicles received and waiting for adviser inspection.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingInspection.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <Clock className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No vehicles pending inspection.</p>
              </div>
            ) : (
              pendingInspection.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        {/* Waiting for Job Allocation */}
        <TabsContent value="waiting-allocation" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Inspection completed — forwarded to Job Controller for technician assignment.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {waitingAllocation.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <Hourglass className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No vehicles waiting for job allocation.</p>
              </div>
            ) : (
              waitingAllocation.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>

        {/* Work in Progress */}
        <TabsContent value="work-in-progress" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Jobs assigned to technicians — currently being worked on.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {workInProgress.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <Wrench className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No vehicles in progress.</p>
              </div>
            ) : (
              workInProgress.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>

        {/* Job Stopped */}
        <TabsContent value="job-stopped" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Jobs stopped by technicians — pending review and reassignment by Job Controller.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {jobStopped.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <StopCircle className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No stopped jobs at this time.</p>
              </div>
            ) : (
              jobStopped.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>

        {/* Pending Final Inspection */}
        <TabsContent value="pending-final" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Technician work completed — perform final inspection before delivery.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {pendingFinal.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <PackageCheck className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No vehicles awaiting final inspection.</p>
              </div>
            ) : (
              pendingFinal.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        {/* Reopened Vehicles */}
        <TabsContent value="reopened" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Vehicles sent back to technician for additional repair after final inspection.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {reopened.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <RotateCcw className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No reopened vehicles.</p>
              </div>
            ) : (
              reopened.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>

        {/* Delivered Vehicles */}
        <TabsContent value="delivered" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Vehicles that passed final inspection and were delivered to the customer.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {delivered.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <TruckIcon className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No delivered vehicles yet.</p>
              </div>
            ) : (
              delivered.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">All vehicles from the current month — {format(now, "MMMM yyyy")}.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
            {historyVehicles.length === 0 ? (
              <div className="col-span-full py-12 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-4 text-muted" />
                <p className="text-lg font-medium">No history found.</p>
              </div>
            ) : (
              historyVehicles.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Inspection Dialog */}
      <Dialog open={!!selectedId} onOpenChange={(val) => {
        if (!val) {
          setSelectedId(null);
          setComplaints([]);
          setServiceNotes("");
          setPdfError("");
          setPdfFileName("");
          if (pdfInputRef.current) pdfInputRef.current.value = "";
        }
      }}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vehicle Inspection Report</DialogTitle></DialogHeader>
          <form onSubmit={handleInspect} className="space-y-5 mt-4">

            {/* RO PDF Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload Repair Order (RO) PDF</label>
              <div
                className="border-2 border-dashed border-border rounded-xl p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => pdfInputRef.current?.click()}
                data-testid="upload-area-pdf"
              >
                {pdfLoading ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm">Reading PDF and extracting complaints...</p>
                  </div>
                ) : pdfFileName ? (
                  <div className="flex items-center justify-center gap-2 text-sm">
                    <FileText className="w-5 h-5 text-red-500 shrink-0" />
                    <span className="font-medium truncate">{pdfFileName}</span>
                    <button type="button" className="text-muted-foreground hover:text-destructive ml-1" onClick={(e) => {
                      e.stopPropagation();
                      setComplaints([]); setPdfFileName(""); setPdfError("");
                      if (pdfInputRef.current) pdfInputRef.current.value = "";
                    }}><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Click to upload RO PDF</p>
                    <p className="text-xs text-muted-foreground mt-1">Complaints will be extracted automatically</p>
                  </>
                )}
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={handlePdfUpload} data-testid="input-pdf-upload" />
              </div>

              {pdfError && (
                <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{pdfError}</span>
                </div>
              )}
            </div>

            {/* Editable Complaints List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Customer Complaints
                  {complaints.length > 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">({complaints.length})</span>}
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs gap-1"
                  onClick={() => setComplaints(prev => [...prev, ""])}
                  data-testid="button-add-complaint"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Complaint
                </Button>
              </div>

              {complaints.length === 0 ? (
                <div className="border border-dashed border-border/60 rounded-lg p-4 text-center text-sm text-muted-foreground">
                  No complaints yet. Upload an RO PDF or click "Add Complaint".
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {complaints.map((c, i) => (
                    <div key={i} className="flex items-center gap-2" data-testid={`complaint-row-${i}`}>
                      <span className="text-xs text-muted-foreground shrink-0 w-5 text-right">{i + 1}.</span>
                      <Input
                        value={c}
                        onChange={e => setComplaints(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                        className="flex-1 h-8 text-sm"
                        placeholder={`Complaint ${i + 1}`}
                        data-testid={`input-complaint-${i}`}
                      />
                      <button
                        type="button"
                        className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        onClick={() => setComplaints(prev => prev.filter((_, j) => j !== i))}
                        data-testid={`button-delete-complaint-${i}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Service Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Recommended Services / Notes</label>
              <Textarea placeholder="Parts needed, services recommended..." value={serviceNotes} onChange={e => setServiceNotes(e.target.value)} data-testid="textarea-service-notes" />
            </div>

            <Button type="submit" className="w-full" disabled={updateVehicle.isPending} data-testid="button-submit-inspection">
              {updateVehicle.isPending ? "Saving..." : "Complete Inspection & Forward"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reopen Dialog */}
      <Dialog open={!!reopenId} onOpenChange={(val) => !val && setReopenId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reopen Job Card</DialogTitle></DialogHeader>
          <form onSubmit={handleReopenSubmit} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Reason for Reopening</label>
              <Textarea required placeholder="Explain why the work needs to be redone..." className="min-h-[100px]" value={reopenReason} onChange={e => setReopenReason(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending}>
              {updateVehicle.isPending ? "Reopening..." : "Confirm Reopen"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Delivery Dialog */}
      <Dialog open={!!showConfirmDeliver} onOpenChange={(val) => !val && setShowConfirmDeliver(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Delivery</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to mark this vehicle as delivered? This will record the current date and time.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowConfirmDeliver(null)}>Cancel</Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => showConfirmDeliver && handleDeliver(showConfirmDeliver)}
                disabled={updateVehicle.isPending}
              >
                {updateVehicle.isPending ? "Updating..." : "Confirm Delivery"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
