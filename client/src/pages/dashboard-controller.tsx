import { useState } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useTechnicians } from "@/hooks/use-users";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import {
  Wrench, History, ClipboardList, User, Car, FileText,
  AlertCircle, ChevronRight, Users, StopCircle, Clock, CheckCircle2, RotateCcw
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

type ComplaintRow = {
  complaint: string;
  technicianId: string;
  estimatedTime: string;
};

type StoredAssignment = {
  complaint: string;
  technicianId: number;
  estimatedTime: string;
};

type HistoryEntry = {
  type: string;
  timestamp?: string;
  technicianId?: number;
  technicianName?: string;
  complaints?: string[];
  estimatedTime?: string;
  stopReason?: string;
  durationSeconds?: number;
  workDetails?: string;
};

export function ControllerDashboard() {
  const { data: vehicles, isLoading } = useVehicles();
  const { data: technicians } = useTechnicians();
  const updateVehicle = useUpdateVehicle();

  const [dialogVehicle, setDialogVehicle] = useState<any | null>(null);
  const [assignments, setAssignments] = useState<ComplaintRow[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const filteredVehicles = vehicles?.filter(v => {
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.jobCardNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || (v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === filterDate);
    return matchesSearch && matchesDate;
  }) || [];

  const pendingAssignments = filteredVehicles.filter(v =>
    v.status === "Waiting for Job Allocation" || v.status === "Inspection Completed"
  );
  const stoppedJobs = filteredVehicles.filter(v => v.status === "Job Stopped");
  const reopenedJobs = filteredVehicles.filter(v => v.status === "Reopened");
  const assignedJobs = filteredVehicles.filter(v =>
    v.status !== "Waiting for Job Allocation" &&
    v.status !== "Inspection Completed" &&
    v.status !== "Job Stopped" &&
    v.status !== "Reopened" &&
    v.status !== "Vehicle Received" &&
    v.status !== "Waiting for Adviser" &&
    v.status !== "Today's Appointment"
  );

  const getTechName = (id: number) => technicians?.find(t => t.id === id)?.name || `Tech #${id}`;

  const openDialog = (vehicle: any) => {
    let complaints: string[] = [];
    try { complaints = JSON.parse(vehicle.complaints || "[]"); } catch {}

    let existing: StoredAssignment[] = [];
    try { existing = JSON.parse(vehicle.complaintAssignments || "[]"); } catch {}

    const existingMap: Record<string, StoredAssignment> = {};
    existing.forEach(a => { existingMap[a.complaint] = a; });

    if (complaints.length > 0) {
      setAssignments(complaints.map(c => ({
        complaint: c,
        technicianId: existingMap[c]?.technicianId?.toString() || "",
        estimatedTime: existingMap[c]?.estimatedTime || "",
      })));
    } else {
      setAssignments([{
        complaint: vehicle.serviceType || "General Service",
        technicianId: vehicle.technicianId?.toString() || "",
        estimatedTime: vehicle.estimatedTime || "",
      }]);
    }
    setDialogVehicle(vehicle);
  };

  const updateAssignment = (index: number, field: keyof ComplaintRow, value: string) => {
    setAssignments(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };

  const appendHistory = (v: any, entry: HistoryEntry): string => {
    let history: HistoryEntry[] = [];
    try { history = JSON.parse(v.jobHistory || "[]"); } catch {}
    history.push({ ...entry, timestamp: new Date().toISOString() });
    return JSON.stringify(history);
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dialogVehicle) return;

    const filled = assignments.filter(a => a.technicianId);
    if (filled.length === 0) return;

    const stored: StoredAssignment[] = filled.map(a => ({
      complaint: a.complaint,
      technicianId: parseInt(a.technicianId),
      estimatedTime: a.estimatedTime,
    }));

    const primaryTech = stored[0];
    const isReassign = dialogVehicle.status === "Job Stopped";

    const newHistory = appendHistory(dialogVehicle, {
      type: isReassign ? "reassigned" : "assigned",
      technicianId: primaryTech.technicianId,
      technicianName: getTechName(primaryTech.technicianId),
      complaints: stored.map(s => s.complaint),
      estimatedTime: stored.map(s => `${s.complaint}: ${s.estimatedTime}`).join("; "),
    });

    updateVehicle.mutate({
      id: dialogVehicle.id,
      technicianId: primaryTech.technicianId,
      estimatedTime: primaryTech.estimatedTime,
      complaintAssignments: JSON.stringify(stored),
      status: "Work in Progress",
      stopReason: isReassign ? null : dialogVehicle.stopReason,
      jobHistory: newHistory,
    }, {
      onSuccess: () => {
        setDialogVehicle(null);
        setAssignments([]);
      }
    });
  };

  const getAssignedTechs = (v: any): string[] => {
    try {
      const arr: StoredAssignment[] = JSON.parse(v.complaintAssignments || "[]");
      return Array.from(new Set(arr.map(a => getTechName(a.technicianId))));
    } catch { return []; }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0m";
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  const JobHistorySection = ({ v }: { v: any }) => {
    const [expanded, setExpanded] = useState(false);
    let history: HistoryEntry[] = [];
    try { history = JSON.parse(v.jobHistory || "[]"); } catch {}
    if (history.length === 0) return null;

    type TechRecord = {
      technicianName: string;
      complaints: string[];
      estimatedTime: string;
      outcome: "completed" | "jobStop" | "active" | null;
      durationSeconds?: number;
      stopReason?: string;
      workDetails?: string;
      assignedAt?: string;
      outcomeAt?: string;
    };

    const techRecords: TechRecord[] = [];
    let current: TechRecord | null = null;

    for (const entry of history) {
      if (entry.type === "assigned" || entry.type === "reassigned") {
        if (current) techRecords.push(current);
        current = {
          technicianName: entry.technicianName || "Unknown",
          complaints: entry.complaints || [],
          estimatedTime: entry.estimatedTime || "",
          outcome: null,
          assignedAt: entry.timestamp,
        };
      } else if (entry.type === "jobStop" && current) {
        current.outcome = "jobStop";
        current.stopReason = entry.stopReason;
        current.durationSeconds = entry.durationSeconds;
        current.outcomeAt = entry.timestamp;
        techRecords.push(current);
        current = null;
      } else if (entry.type === "completed" && current) {
        current.outcome = "completed";
        current.durationSeconds = entry.durationSeconds;
        current.workDetails = entry.workDetails;
        current.outcomeAt = entry.timestamp;
        techRecords.push(current);
        current = null;
      }
    }
    if (current) {
      current.outcome = "active";
      techRecords.push(current);
    }

    return (
      <div className="mt-3 border-t border-border/50 pt-3">
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors"
          onClick={() => setExpanded(x => !x)}
          data-testid={`btn-job-history-${v.id}`}
        >
          <History className="w-3.5 h-3.5" />
          Job History ({techRecords.length} technician{techRecords.length !== 1 ? "s" : ""})
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {expanded && (
          <div className="mt-3 space-y-3">
            {techRecords.map((rec, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 text-xs ${
                  rec.outcome === "completed"
                    ? "border-green-200 dark:border-green-800 bg-green-50/60 dark:bg-green-900/10"
                    : rec.outcome === "jobStop"
                    ? "border-rose-200 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-900/10"
                    : "border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/10"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {rec.outcome === "completed" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    ) : rec.outcome === "jobStop" ? (
                      <StopCircle className="w-3.5 h-3.5 text-rose-500" />
                    ) : (
                      <Wrench className="w-3.5 h-3.5 text-blue-500" />
                    )}
                    <span>{rec.technicianName}</span>
                    {i > 0 && <span className="text-[10px] font-normal text-muted-foreground">(Reassigned)</span>}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    rec.outcome === "completed"
                      ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                      : rec.outcome === "jobStop"
                      ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-400"
                      : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                  }`}>
                    {rec.outcome === "completed" ? "Completed" : rec.outcome === "jobStop" ? "Job Stopped" : "Active"}
                  </span>
                </div>

                {rec.complaints.length > 0 && (
                  <div className="mb-2">
                    <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Complaints assigned:</span>
                    <ul className="mt-0.5 space-y-0.5">
                      {rec.complaints.map((c, j) => (
                        <li key={j} className="pl-2 text-[11px] line-clamp-1">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                  {rec.estimatedTime && (
                    <span><Clock className="w-3 h-3 inline mr-0.5" />Est: {rec.estimatedTime}</span>
                  )}
                  {rec.durationSeconds != null && rec.durationSeconds > 0 && (
                    <span><Clock className="w-3 h-3 inline mr-0.5" />Actual: {formatDuration(rec.durationSeconds)}</span>
                  )}
                  {rec.assignedAt && (
                    <span>{format(new Date(rec.assignedAt), "dd MMM, HH:mm")}</span>
                  )}
                </div>

                {rec.stopReason && (
                  <p className="mt-1.5 text-[11px] text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 px-2 py-1 rounded">
                    Stop reason: {rec.stopReason}
                  </p>
                )}
                {rec.workDetails && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{rec.workDetails}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const VehicleCard = ({ v, showAction = true, isStoppage = false, isReopened = false }: { v: any; showAction?: boolean; isStoppage?: boolean; isReopened?: boolean }) => {
    const assignedTechs = getAssignedTechs(v);

    let complaints: string[] = [];
    try { complaints = JSON.parse(v.complaints || "[]"); } catch {}

    return (
      <Card className={`shadow-sm transition-all duration-200 hover:shadow-md ${
        isStoppage ? "border-l-4 border-l-rose-500" :
        isReopened ? "border-l-4 border-l-amber-500" :
        showAction ? "border-l-4 border-l-orange-500" :
        "border border-border/50"
      }`}>
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="font-bold text-base">{v.jobCardNumber || "—"}</p>
              <p className="text-sm text-muted-foreground">{v.vehicleModel} · {v.vehicleNumber}</p>
            </div>
            <StatusBadge status={v.status} />
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-muted-foreground block">Customer</span>
              <span className="font-medium">{v.customerName}</span>
            </div>
            <div className="bg-muted/40 rounded-lg px-3 py-2">
              <span className="text-muted-foreground block">Adviser</span>
              <span className="font-medium">{v.serviceAdviser || "—"}</span>
            </div>
          </div>

          {/* Stop Reason */}
          {isStoppage && v.stopReason && (
            <div className="mb-3 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-0.5">Stop Reason</p>
              <p className="text-xs">{v.stopReason}</p>
            </div>
          )}

          {complaints.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                Complaints ({complaints.length})
              </p>
              <ul className="space-y-1">
                {complaints.slice(0, 2).map((c, i) => (
                  <li key={i} className="text-xs bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-2 py-1 flex items-start gap-1">
                    <AlertCircle className="w-3 h-3 mt-0.5 text-amber-500 shrink-0" />
                    <span className="line-clamp-1">{c}</span>
                  </li>
                ))}
                {complaints.length > 2 && (
                  <li className="text-xs text-muted-foreground pl-2">+{complaints.length - 2} more</li>
                )}
              </ul>
            </div>
          )}

          {assignedTechs.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {assignedTechs.map((name, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  <Wrench className="w-3 h-3 mr-1" />{name}
                </Badge>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            variant={showAction || isStoppage || isReopened ? "default" : "outline"}
            onClick={() => openDialog(v)}
            data-testid={`button-assign-${v.id}`}
          >
            <Wrench className="w-4 h-4 mr-2" />
            {isStoppage ? "Reassign Technician" : isReopened ? "Assign Technician" : showAction ? "Assign Technician" : "Reallocate Technician"}
          </Button>

          {/* Job History */}
          <JobHistorySection v={v} />
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Job Controller</h2>
        <p className="text-muted-foreground mt-1">Assign complaints to technicians and manage job stoppages.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search by vehicle, job card, or customer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search-controller"
          />
        </div>
        <div className="w-full md:w-44">
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            data-testid="input-filter-date-controller"
          />
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <div className="overflow-x-auto pb-1 mb-6">
          <TabsList className="inline-flex h-auto w-max min-w-full gap-1 p-1.5 bg-muted rounded-xl">
            <TabsTrigger value="active" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <ClipboardList className="w-4 h-4" />
              Needs Assignment
              {pendingAssignments.length > 0 && <span className="ml-1 rounded-full bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{pendingAssignments.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="stoppage" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <StopCircle className="w-4 h-4" />
              Job Stoppage
              {stoppedJobs.length > 0 && <span className="ml-1 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{stoppedJobs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="reopened" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap" data-testid="tab-controller-reopened">
              <RotateCcw className="w-4 h-4" />
              Reopened Jobs
              {reopenedJobs.length > 0 && <span className="ml-1 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{reopenedJobs.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm whitespace-nowrap">
              <History className="w-4 h-4" />
              Assigned / History
              {assignedJobs.length > 0 && <span className="ml-1 rounded-full bg-muted-foreground/50 text-white text-[10px] font-bold px-1.5 py-0.5 leading-none">{assignedJobs.length}</span>}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {isLoading ? (
              <p className="text-muted-foreground">Loading...</p>
            ) : pendingAssignments.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <ClipboardList className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No vehicles need assignment.</p>
                <p className="text-sm mt-1">Vehicles appear here once inspection is completed.</p>
              </div>
            ) : (
              pendingAssignments.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="stoppage" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Jobs stopped by technicians — review the reason and reassign as needed.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {stoppedJobs.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <StopCircle className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No job stoppages at this time.</p>
              </div>
            ) : (
              stoppedJobs.map(v => <VehicleCard key={v.id} v={v} isStoppage={true} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="reopened" className="mt-0">
          <div className="mb-4">
            <p className="text-sm text-muted-foreground">Jobs reopened by the service adviser — review and reassign to a technician.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {reopenedJobs.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <RotateCcw className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No reopened jobs at this time.</p>
              </div>
            ) : (
              reopenedJobs.map(v => (
                <VehicleCard key={v.id} v={v} isReopened={true} />
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {assignedJobs.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No job history found.</p>
              </div>
            ) : (
              assignedJobs.map(v => <VehicleCard key={v.id} v={v} showAction={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign / Reassign Dialog */}
      <Dialog open={!!dialogVehicle} onOpenChange={open => { if (!open) { setDialogVehicle(null); setAssignments([]); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              {dialogVehicle?.status === "Job Stopped" ? "Reassign Technician" : dialogVehicle?.status === "Reopened" ? "Assign Technician (Reopened Job)" : "Assign Technician"}
            </DialogTitle>
          </DialogHeader>

          {dialogVehicle && (
            <form onSubmit={handleAssign} className="space-y-5 mt-1">
              {/* Vehicle Details */}
              <div className="bg-muted/40 rounded-xl p-4 space-y-2 border border-border/50">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Vehicle Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs block">Model / Number</span>
                      <span className="font-medium">{dialogVehicle.vehicleModel} · {dialogVehicle.vehicleNumber}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs block">Job Card</span>
                      <span className="font-medium">{dialogVehicle.jobCardNumber || "—"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs block">Customer</span>
                      <span className="font-medium">{dialogVehicle.customerName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <span className="text-muted-foreground text-xs block">Service Adviser</span>
                      <span className="font-medium">{dialogVehicle.serviceAdviser || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop Reason (if reassigning) */}
              {dialogVehicle.status === "Job Stopped" && dialogVehicle.stopReason && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-900/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-400 mb-1">Stop Reason</p>
                  <p className="text-sm">{dialogVehicle.stopReason}</p>
                </div>
              )}

              {/* Inspection Notes */}
              {dialogVehicle.serviceNotes && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">Inspection Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{dialogVehicle.serviceNotes}</p>
                </div>
              )}

              {/* Complaint Assignments */}
              <div className="space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  {dialogVehicle.status === "Job Stopped" ? "Reassign Each Complaint" : "Assign Each Complaint to a Technician"}
                </p>

                {assignments.map((row, idx) => (
                  <div key={idx} className="border border-border/60 rounded-xl p-4 space-y-3 bg-card">
                    <div className="flex items-start gap-2">
                      <ChevronRight className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-sm font-medium leading-snug">{row.complaint}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Technician</label>
                        <Select
                          value={row.technicianId}
                          onValueChange={val => updateAssignment(idx, "technicianId", val)}
                        >
                          <SelectTrigger data-testid={`select-tech-${idx}`} className="h-9 text-sm">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                          <SelectContent>
                            {technicians?.map(t => (
                              <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Estimated Time</label>
                        <Input
                          placeholder="e.g., 2 Hours"
                          value={row.estimatedTime}
                          onChange={e => updateAssignment(idx, "estimatedTime", e.target.value)}
                          className="h-9 text-sm"
                          data-testid={`input-est-time-${idx}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {assignments.every(a => !a.technicianId) && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Please assign at least one complaint to a technician.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setDialogVehicle(null); setAssignments([]); }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={updateVehicle.isPending || assignments.every(a => !a.technicianId)}
                  data-testid="button-confirm-assign"
                >
                  {updateVehicle.isPending ? "Assigning..." : "Confirm Assignment"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
