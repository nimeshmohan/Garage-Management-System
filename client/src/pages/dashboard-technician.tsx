import { useState, useEffect } from "react";
import { useVehicles, useUpdateVehicle } from "@/hooks/use-vehicles";
import { useUser } from "@/hooks/use-auth";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/status-badge";
import {
  PlayCircle, CheckCircle2, History, ClipboardList, PauseCircle,
  StopCircle, Clock, AlertCircle, ChevronRight, Car, User
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";

type AssignmentEntry = {
  complaint: string;
  technicianId: number;
  estimatedTime: string;
};

type HistoryEntry = {
  type: string;
  timestamp?: string;
  technicianId?: number;
  technicianName?: string;
  stopReason?: string;
  durationSeconds?: number;
  workDetails?: string;
};

export function TechnicianDashboard() {
  const { data: user } = useUser();
  const { data: vehicles, isLoading } = useVehicles();
  const updateVehicle = useUpdateVehicle();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [workDetails, setWorkDetails] = useState("");
  const [stopReason, setStopReason] = useState("");
  const [stopJobVehicle, setStopJobVehicle] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState<Record<number, number>>({});

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const getMyAssignments = (v: any): AssignmentEntry[] => {
    if (!user) return [];
    try {
      const arr: AssignmentEntry[] = JSON.parse(v.complaintAssignments || "[]");
      return arr.filter(a => a.technicianId === user.id);
    } catch { return []; }
  };

  const isAssignedToMe = (v: any): boolean => {
    if (!user) return false;
    if (v.technicianId === user.id) return true;
    return getMyAssignments(v).length > 0;
  };

  const appendHistory = (v: any, entry: HistoryEntry): string => {
    let history: HistoryEntry[] = [];
    try { history = JSON.parse(v.jobHistory || "[]"); } catch {}
    history.push({ ...entry, timestamp: new Date().toISOString() });
    return JSON.stringify(history);
  };

  const filteredVehicles = vehicles?.filter(v => {
    const matchesSearch =
      v.vehicleNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.jobCardNumber || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.customerName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = !filterDate || (v.createdAt && format(new Date(v.createdAt), 'yyyy-MM-dd') === filterDate);
    return matchesSearch && matchesDate;
  }) || [];

  const activeStatuses = ["Work in Progress", "Waiting for Technician Approval", "Reopened", "Job Stopped"];
  const activeJobs = filteredVehicles.filter(v => isAssignedToMe(v) && activeStatuses.includes(v.status));
  const completedJobs = filteredVehicles.filter(v => isAssignedToMe(v) && (v.status === "Ready for Delivery" || v.status === "Delivered"));

  useEffect(() => {
    const timer = setInterval(() => {
      const updates: Record<number, number> = {};
      vehicles?.forEach(v => {
        let total = v.totalWorkDuration || 0;
        if (v.isTimerRunning && v.lastTimerStartedAt) {
          const start = new Date(v.lastTimerStartedAt).getTime();
          const now = Date.now();
          const elapsed = Math.floor((now - start) / 1000);
          if (!isNaN(elapsed) && elapsed > 0) total += elapsed;
        }
        updates[v.id] = total;
      });
      setCurrentTime(updates);
    }, 1000);
    return () => clearInterval(timer);
  }, [vehicles]);

  const toggleTimer = (v: any) => {
    if (v.isTimerRunning) {
      const start = new Date(v.lastTimerStartedAt).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - start) / 1000);
      const newTotal = (v.totalWorkDuration || 0) + (isNaN(elapsed) || elapsed < 0 ? 0 : elapsed);
      updateVehicle.mutate({ id: v.id, isTimerRunning: false, totalWorkDuration: newTotal, lastTimerStartedAt: null });
    } else {
      updateVehicle.mutate({
        id: v.id,
        isTimerRunning: true,
        lastTimerStartedAt: new Date().toISOString(),
        status: (v.status === "Waiting for Technician Approval" || v.status === "Reopened") ? "Work in Progress" : v.status,
      });
    }
  };

  const handleJobStopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stopJobVehicle || !stopReason.trim()) return;
    const v = stopJobVehicle;

    // Stop timer if running
    let newDuration = v.totalWorkDuration || 0;
    let timerUpdates: any = {};
    if (v.isTimerRunning && v.lastTimerStartedAt) {
      const start = new Date(v.lastTimerStartedAt).getTime();
      const elapsed = Math.floor((Date.now() - start) / 1000);
      newDuration += Math.max(0, elapsed);
      timerUpdates = { isTimerRunning: false, totalWorkDuration: newDuration, lastTimerStartedAt: null };
    }

    const newHistory = appendHistory(v, {
      type: "jobStop",
      technicianId: user?.id,
      technicianName: user?.name,
      stopReason: stopReason.trim(),
    } as HistoryEntry);

    updateVehicle.mutate({
      id: v.id,
      status: "Job Stopped",
      stopReason: stopReason.trim(),
      jobHistory: newHistory,
      ...timerUpdates,
    }, {
      onSuccess: () => { setStopJobVehicle(null); setStopReason(""); }
    });
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFinishJob = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const v = vehicles?.find(veh => veh.id === selectedId);
    let totalDuration = v?.totalWorkDuration || 0;
    if (v?.isTimerRunning && v.lastTimerStartedAt) {
      const start = new Date(v.lastTimerStartedAt).getTime();
      totalDuration += Math.floor((Date.now() - start) / 1000);
    }

    const newHistory = appendHistory(v, {
      type: "completed",
      technicianId: user?.id,
      technicianName: user?.name,
      durationSeconds: totalDuration,
      workDetails,
    } as HistoryEntry);

    updateVehicle.mutate({
      id: selectedId,
      workDetails,
      status: "Ready for Delivery",
      isTimerRunning: false,
      totalWorkDuration: totalDuration,
      lastTimerStartedAt: null,
      jobHistory: newHistory,
    }, { onSuccess: () => { setSelectedId(null); setWorkDetails(""); } });
  };

  const VehicleCard = ({ v, showActions = true }: { v: any; showActions?: boolean }) => {
    const myAssignments = getMyAssignments(v);
    const isStopped = v.status === "Job Stopped";

    return (
      <Card className="border-border/50 shadow-lg relative overflow-hidden group">
        <div className={`absolute top-0 left-0 w-1 h-full ${isStopped ? "bg-rose-500" : showActions ? "bg-primary" : "bg-muted-foreground/30"} group-hover:w-2 transition-all duration-300`} />
        <CardContent className="p-5 pb-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-bold text-lg">{v.vehicleModel}</h3>
              <p className="text-sm font-medium text-primary">{v.jobCardNumber}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <StatusBadge status={v.status} />
              {showActions && !isStopped && (
                <div className="text-base font-mono font-bold bg-muted px-2 py-1 rounded text-foreground">
                  {formatTime(currentTime[v.id] || 0)}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div className="bg-muted/40 p-2.5 rounded-lg flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground block">Customer</span>
                <span className="font-medium">{v.customerName}</span>
              </div>
            </div>
            <div className="bg-muted/40 p-2.5 rounded-lg flex items-center gap-2">
              <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div>
                <span className="text-muted-foreground block">Vehicle</span>
                <span className="font-medium">{v.vehicleNumber}</span>
              </div>
            </div>
          </div>

          {/* Stop Reason (when stopped) */}
          {isStopped && v.stopReason && (
            <div className="mb-3 bg-rose-50 dark:bg-rose-900/15 border border-rose-200 dark:border-rose-800 rounded-lg px-3 py-2">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-400 mb-0.5">Stop Reason</p>
              <p className="text-xs">{v.stopReason}</p>
            </div>
          )}

          {/* My Assigned Complaints */}
          {myAssignments.length > 0 ? (
            <div className="mb-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">My Assigned Tasks</p>
              {myAssignments.map((a, i) => (
                <div key={i} className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <div className="flex items-start gap-2">
                    <ChevronRight className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                    <p className="text-xs font-medium flex-1">{a.complaint}</p>
                  </div>
                  {a.estimatedTime && (
                    <div className="flex items-center gap-1 mt-1 ml-5">
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Est: </span>
                      <span className="text-xs font-medium">{a.estimatedTime}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div className="bg-muted/40 p-2.5 rounded-lg">
                <span className="text-muted-foreground block">Service</span>
                <span className="font-medium">{v.serviceType || "—"}</span>
              </div>
              <div className="bg-muted/40 p-2.5 rounded-lg">
                <span className="text-muted-foreground block">Est. Time</span>
                <span className="font-medium">{v.estimatedTime || "Not set"}</span>
              </div>
            </div>
          )}

          {/* Adviser Notes */}
          {v.serviceNotes && (
            <div className="mb-3">
              <span className="text-xs text-muted-foreground block mb-1">Adviser Notes</span>
              <p className="text-xs bg-blue-50/50 dark:bg-blue-900/10 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                {v.serviceNotes}
              </p>
            </div>
          )}

          {v.workDetails && (
            <div>
              <span className="text-xs text-muted-foreground block mb-1">Work Done</span>
              <p className="text-xs bg-green-50/50 dark:bg-green-900/10 p-2.5 rounded-lg border border-green-100 dark:border-green-900/30">
                {v.workDetails}
              </p>
            </div>
          )}
        </CardContent>

        {showActions && !isStopped && (
          <CardFooter className="bg-muted/20 border-t px-4 py-3 flex flex-wrap gap-2">
            <Button
              variant={v.isTimerRunning ? "destructive" : "default"}
              className="flex-1 shadow-sm"
              onClick={() => toggleTimer(v)}
              data-testid={`button-timer-${v.id}`}
            >
              {v.isTimerRunning
                ? <><PauseCircle className="w-4 h-4 mr-2" />Pause</>
                : <><PlayCircle className="w-4 h-4 mr-2" />{v.status === "Waiting for Technician Approval" || v.status === "Reopened" ? "Start Work" : "Resume"}</>
              }
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-rose-400 text-rose-600 hover:bg-rose-50 dark:border-rose-600 dark:text-rose-400"
              onClick={() => setStopJobVehicle(v)}
              data-testid={`button-job-stop-${v.id}`}
            >
              <StopCircle className="w-4 h-4 mr-2" />Job Stop
            </Button>
            <Button
              variant="default"
              className="w-full bg-green-600 hover:bg-green-700 shadow-sm"
              onClick={() => setSelectedId(v.id)}
              data-testid={`button-complete-${v.id}`}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />Mark Completed
            </Button>
          </CardFooter>
        )}

        {showActions && isStopped && (
          <CardFooter className="bg-rose-50/50 dark:bg-rose-900/10 border-t border-rose-200 dark:border-rose-800 px-4 py-3">
            <p className="text-xs text-rose-600 dark:text-rose-400 text-center w-full">
              Job stopped — awaiting reassignment from Job Controller.
            </p>
          </CardFooter>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-display font-bold text-foreground">Technician Dashboard</h2>
        <p className="text-muted-foreground mt-1">Review your assigned tasks and update job progress.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Filter by vehicle number or job card..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            data-testid="input-search-tech"
          />
        </div>
        <div className="w-full md:w-44">
          <Input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            data-testid="input-filter-date-tech"
          />
        </div>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="active" className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4" />
            My Active Jobs ({activeJobs.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Completed ({completedJobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {isLoading ? (
              <p className="text-muted-foreground">Loading jobs...</p>
            ) : activeJobs.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <ClipboardList className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No active jobs assigned.</p>
              </div>
            ) : (
              activeJobs.map(v => <VehicleCard key={v.id} v={v} />)
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {completedJobs.length === 0 ? (
              <div className="col-span-full py-14 flex flex-col items-center justify-center text-muted-foreground bg-card border border-dashed rounded-2xl">
                <History className="w-12 h-12 mb-3 text-muted" />
                <p className="text-base font-medium">No completed jobs found.</p>
              </div>
            ) : (
              completedJobs.map(v => <VehicleCard key={v.id} v={v} showActions={false} />)
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Job Stop Dialog */}
      <Dialog open={!!stopJobVehicle} onOpenChange={val => { if (!val) { setStopJobVehicle(null); setStopReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StopCircle className="w-5 h-5 text-rose-500" />
              Job Stop
            </DialogTitle>
          </DialogHeader>
          {stopJobVehicle && (
            <form onSubmit={handleJobStopSubmit} className="space-y-4 mt-2">
              <div className="bg-muted/40 rounded-lg px-4 py-3 text-sm">
                <p className="font-medium">{stopJobVehicle.vehicleModel} · {stopJobVehicle.vehicleNumber}</p>
                <p className="text-muted-foreground text-xs">{stopJobVehicle.jobCardNumber} — {stopJobVehicle.customerName}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Stop</label>
                <Textarea
                  required
                  placeholder="Describe why work is being stopped (missing parts, special tool required, etc.)..."
                  className="min-h-[100px]"
                  value={stopReason}
                  onChange={e => setStopReason(e.target.value)}
                  data-testid="textarea-stop-reason"
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setStopJobVehicle(null); setStopReason(""); }}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-rose-600 hover:bg-rose-700" disabled={updateVehicle.isPending || !stopReason.trim()} data-testid="button-confirm-stop">
                  {updateVehicle.isPending ? "Stopping..." : "Confirm Job Stop"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Job Dialog */}
      <Dialog open={!!selectedId} onOpenChange={val => { if (!val) { setSelectedId(null); setWorkDetails(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Job</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleFinishJob} className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Work Done Details</label>
              <Textarea
                required
                placeholder="Describe the repairs and services completed..."
                className="min-h-[120px]"
                value={workDetails}
                onChange={e => setWorkDetails(e.target.value)}
                data-testid="textarea-work-details"
              />
            </div>
            <Button type="submit" className="w-full" disabled={updateVehicle.isPending} data-testid="button-finish-job">
              {updateVehicle.isPending ? "Submitting..." : "Finish Job & Mark Ready"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
